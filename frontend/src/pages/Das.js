import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/Das.css';

const Das = () => {
  const hoje = new Date();
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
  const anoAtual = hoje.getFullYear();
  const [competencia, setCompetencia] = useState(`${mesAtual}/${anoAtual}`);

  // Função para formatar CNPJ para exibição
  const formatarCNPJ = (cnpj) => {
    if (!cnpj) return '';
    const limpo = cnpj.replace(/\D/g, '');
    if (limpo.length === 14) {
      return `${limpo.slice(0,2)}.${limpo.slice(2,5)}.${limpo.slice(5,8)}/${limpo.slice(8,12)}-${limpo.slice(12)}`;
    }
    return limpo;
  };

  const [empresas, setEmpresas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [emitindo, setEmitindo] = useState(false);

  const [filtros, setFiltros] = useState({
    razaosocial: '',
    cnpj: ''
  });

  // Função para carregar empresas
  const carregarEmpresas = useCallback(() => {
    setCarregando(true);
    setMensagem('');

    const accessToken = localStorage.getItem('access');
    
    axios
      .get(`${process.env.REACT_APP_API_BASE}/api/empresas-das/`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      .then((res) => {
        if (Array.isArray(res.data)) {
          setEmpresas(res.data);
        } else {
          console.error('Dados recebidos não são um array:', res.data);
          setMensagem('Formato de dados inválido');
        }
        setCarregando(false);
      })
      .catch((error) => {
        console.error('Erro ao carregar empresas:', error);
        const errorMsg = error.response?.data?.erro || 
                         error.response?.data?.mensagem || 
                         error.message || 
                         'Erro desconhecido ao carregar empresas';
        setMensagem(`Erro: ${errorMsg}`);
        setCarregando(false);
      });
  }, []);

  useEffect(() => {
    carregarEmpresas();
  }, [carregarEmpresas]);

  // Função para alternar seleção de empresa
  const handleCheckbox = (cnpj) => {
    setSelecionadas((prev) =>
      prev.includes(cnpj) 
        ? prev.filter((item) => item !== cnpj) 
        : [...prev, cnpj]
    );
  };

  // Selecionar todas
  const selecionarTodas = () => {
    const empresasFiltradas = empresas.filter(emp =>
      Object.entries(filtros).every(([campo, valor]) =>
        emp[campo]?.toString().toLowerCase().includes(valor.toLowerCase())
      )
    );
    if (selecionadas.length === empresasFiltradas.length) {
      setSelecionadas([]);
    } else {
      setSelecionadas(empresasFiltradas.map(emp => emp.cnpj));
    }
  };

  // ================================
  // Emitir Recibos
  // ================================
  const emitirRecibos = async () => {
    if (selecionadas.length === 0) {
      setMensagem('Selecione ao menos uma empresa');
      return;
    }

    const accessToken = localStorage.getItem('access');
    setEmitindo(true);
    setMensagem('Emitindo recibos...');

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE}/api/pgdas/recibos/`,
        { cnpjs: selecionadas, competencia },
        { 
          responseType: 'blob',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          validateStatus: () => true
        }
      );

      const contentType = response.headers['content-type'];

      if (contentType && contentType.includes('application/json')) {
        const text = await response.data.text();
        const json = JSON.parse(text);
        setMensagem(`Erro: ${json.mensagem || 'Erro desconhecido'}`);
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recibos_das_${competencia.replace('/', '_')}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMensagem('Recibos emitidos com sucesso!');
    } catch (error) {
      console.error('Erro ao emitir recibos:', error);
      setMensagem(`Erro inesperado: ${error.message}`);
    } finally {
      setEmitindo(false);
    }
  };

  // ================================
  // Gerar DAS
  // ================================
  const gerarDas = async () => {
    if (selecionadas.length === 0) {
      setMensagem('Selecione ao menos uma empresa');
      return;
    }

    const accessToken = localStorage.getItem('access');
    setEmitindo(true);
    setMensagem('Gerando DAS...');

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE}/api/das/gerar/`,
        { cnpjs: selecionadas, competencia },
        { 
          responseType: 'blob',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          validateStatus: () => true
        }
      );

      const contentType = response.headers['content-type'];

      if (contentType && contentType.includes('application/json')) {
        const text = await response.data.text();
        const json = JSON.parse(text);

        if (json.empresas_sem_declaracao) {
          const listaEmpresas = json.empresas_sem_declaracao.map(emp => 
            `CNPJ: ${formatarCNPJ(emp.cnpj)} - ${emp.razaosocial}`
          ).join('\n');
          setMensagem(`Nenhuma declaração encontrada para as empresas:\n${listaEmpresas}`);
        } else {
          setMensagem(`Erro: ${json.mensagem || 'Erro desconhecido'}`);
        }
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `das_gerados_${competencia.replace('/', '_')}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMensagem('DAS gerados com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar DAS:', error);
      setMensagem(`Erro inesperado: ${error.message}`);
    } finally {
      setEmitindo(false);
    }
  };

  // Filtrar empresas
  const empresasFiltradas = empresas.filter(emp =>
    Object.entries(filtros).every(([campo, valor]) =>
      emp[campo]?.toString().toLowerCase().includes(valor.toLowerCase())
    )
  );

  return (
    <div className="das-page">
      <div className="container mt-5 shadow p-4 rounded bg-white">
        <div className="header-wrapper d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center">
            <i className="fas fa-file-alt header-icon me-2"></i>
            <h2 className="titulo-pagina m-0">Relatórios DAS</h2>
          </div>
        </div>

        {mensagem && (
          <div className={`alert ${mensagem.includes('Erro') ? 'alert-danger' : 'alert-success'}`}>
            <pre className="m-0">{mensagem}</pre>
          </div>
        )}

        <div className="d-flex flex-wrap justify-content-end gap-2 mb-2">
          <button 
            className="btn btn-primary px-4"
            onClick={gerarDas}
            disabled={emitindo || selecionadas.length === 0}
          >
            {emitindo ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Gerando...
              </>
            ) : (
              <>
                <i className="fas fa-file-invoice me-2"></i>
                Gerar DAS
              </>
            )}
          </button>

          <button 
            className="btn btn-primary px-4"
            onClick={emitirRecibos}
            disabled={emitindo || selecionadas.length === 0}
          >
            {emitindo ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Emitindo...
              </>
            ) : (
              <>
                <i className="fas fa-file-pdf me-2"></i>
                Emitir Recibos
              </>
            )}
          </button>
        </div>

        <div className="d-flex gap-2 mb-3">
          <div>
            <label className="form-label fw-bold">Mês</label>
            <select
              className="form-select"
              value={competencia.split('/')[0]}
              onChange={(e) => {
                const ano = competencia.split('/')[1];
                setCompetencia(`${e.target.value}/${ano}`);
              }}
            >
              <option value="">MM</option>
              {Array.from({ length: 12 }, (_, i) => {
                const mes = String(i + 1).padStart(2, '0');
                return <option key={mes} value={mes}>{mes}</option>;
              })}
            </select>
          </div>

          <div>
            <label className="form-label fw-bold">Ano</label>
            <select
              className="form-select"
              value={competencia.split('/')[1]}
              onChange={(e) => {
                const mes = competencia.split('/')[0];
                setCompetencia(`${mes}/${e.target.value}`);
              }}
            >
              <option value="">AAAA</option>
              {Array.from({ length: 5 }, (_, i) => {
                const ano = 2021 + i;
                return <option key={ano} value={ano}>{ano}</option>;
              })}
            </select>
          </div>
        </div>

        <div className="table-responsive">
          {carregando ? (
            <div className="text-center mt-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Carregando...</span>
              </div>
              <p>Carregando empresas...</p>
            </div>
          ) : (
            <table className="table table-bordered table-hover text-center align-middle fs-6">
              <thead className="table-light">
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selecionadas.length === empresasFiltradas.length && empresasFiltradas.length > 0}
                      onChange={selecionarTodas}
                    />
                  </th>
                  <th>
                    Razão Social
                    <input
                      type="text"
                      className="form-control form-control-sm mt-1"
                      placeholder="Filtrar..."
                      value={filtros.razaosocial}
                      onChange={(e) => setFiltros(prev => ({ ...prev, razaosocial: e.target.value }))}
                    />
                  </th>
                  <th>
                    CNPJ
                    <input
                      type="text"
                      className="form-control form-control-sm mt-1"
                      placeholder="Filtrar..."
                      value={filtros.cnpj}
                      onChange={(e) => setFiltros(prev => ({ ...prev, cnpj: e.target.value }))}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {empresasFiltradas.map((empresa) => (
                  <tr key={empresa.cnpj}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selecionadas.includes(empresa.cnpj)}
                        onChange={() => handleCheckbox(empresa.cnpj)}
                      />
                    </td>
                    <td className="text-start">{empresa.razaosocial}</td>
                    <td>{formatarCNPJ(empresa.cnpj)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {!carregando && empresasFiltradas.length === 0 && (
            <div className="text-center mt-4">
              <p className="text-muted">Nenhuma empresa encontrada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Das;
