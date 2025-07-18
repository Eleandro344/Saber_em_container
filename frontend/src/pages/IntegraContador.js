import React, { useState, useEffect, useRef } from 'react';
import '../styles/integraContador.css';

const IntegraContador = () => {
  const [mensagem, setMensagem] = useState('');
  const [executando, setExecutando] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [novaRazao, setNovaRazao] = useState('');
  const [novoCnpj, setNovoCnpj] = useState('');

  const cancelado = useRef(false);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE}/api/empresas/`)
      .then(res => res.json())
      .then(data => setEmpresas(data))
      .catch(() => setMensagem('Erro ao carregar empresas'));
  }, []);

  const toggleSelecionada = (cnpj) => {
    setSelecionadas(prev =>
      prev.includes(cnpj)
        ? prev.filter(item => item !== cnpj)
        : [...prev, cnpj]
    );
  };

  const toggleTodas = () => {
    if (selecionadas.length === empresas.length) {
      setSelecionadas([]);
    } else {
      setSelecionadas(empresas.map(emp => emp.cnpj));
    }
  };

  const todasSelecionadas = empresas.length > 0 && selecionadas.length === empresas.length;

  const handleCancelar = () => {
    cancelado.current = true;
    setMensagem('Execução cancelada pelo usuário.');
    setExecutando(false);
  };

  const handleExecutar = async () => {
    if (selecionadas.length === 0) {
      setMensagem('Selecione ao menos uma empresa.');
      return;
    }

    cancelado.current = false;
    setExecutando(true);
    setMensagem('Executando integração...');

    const formData = new FormData();
    formData.append('cnpjs', JSON.stringify(selecionadas));

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/executar-integra/`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.mensagem || 'Erro desconhecido');
      }

      if (cancelado.current) return;

      const blob = await response.blob();
      if (cancelado.current) return;

      // Verifica falhas via header customizado
      const falhasHeader = response.headers.get('X-Falhas');
      let mensagemFinal = 'Download realizado com sucesso!';

      if (falhasHeader) {
        try {
          const falhas = JSON.parse(falhasHeader);
          if (falhas.length > 0) {
            mensagemFinal += `\n\n⚠️ Algumas empresas apresentaram erro:\n${falhas.join('\n')}`;
          }
        } catch (e) {
          console.warn('Erro ao processar falhas do header:', e);
        }
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'relatorios.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();

      setMensagem(mensagemFinal);
    } catch (error) {
      if (!cancelado.current) {
        setMensagem(`Erro ao executar integração: ${error.message}`);
      }
    } finally {
      setExecutando(false);
    }
  };

  const handleExcluirEmpresa = async (cnpj) => {
    if (!window.confirm(`Tem certeza que deseja excluir o CNPJ ${cnpj}?`)) return;

    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE}/api/empresas/${cnpj}/`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (res.ok) {
        setEmpresas(prev => prev.filter(e => e.cnpj !== cnpj));
        setSelecionadas(prev => prev.filter(c => c !== cnpj));
        setMensagem(`Empresa ${cnpj} excluída com sucesso.`);
      } else {
        setMensagem(`Erro ao excluir: ${data.erro || 'Erro desconhecido'}`);
      }
    } catch (error) {
      setMensagem(`Erro ao excluir: ${error.message}`);
    }
  };

  const handleAdicionarEmpresa = async () => {
    if (!novaRazao || !novoCnpj) {
      setMensagem("Preencha os campos para adicionar.");
      return;
    }
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE}/api/empresas/adicionar/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ razaosocial: novaRazao, cnpj: novoCnpj })
      });
      const data = await res.json();
      if (res.ok) {
        setMensagem(data.mensagem);
        setNovaRazao('');
        setNovoCnpj('');
        setEmpresas(prev => [...prev, { razaosocial: novaRazao, cnpj: novoCnpj }]);
      } else {
        setMensagem(data.erro || 'Erro ao adicionar empresa');
      }
    } catch (error) {
      setMensagem(`Erro ao adicionar: ${error.message}`);
    }
  };

  return (
    <div className="container-integra">
      <h2>Relatórios Fiscais</h2>

      <div className="form-adicionar mb-4 p-4" style={{ backgroundColor: '#f4f8ff', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)' }}>
        <h4 style={{ fontWeight: '600', marginBottom: '1rem', color: '#2c3e50' }}>Adicionar nova empresa</h4>
        <div className="form-group">
          <label>Razão Social:</label>
          <input
            type="text"
            className="form-control"
            value={novaRazao}
            onChange={(e) => setNovaRazao(e.target.value)}
            placeholder="Digite a razão social"
          />
        </div>
        <div className="form-group">
          <label>CNPJ:</label>
          <input
            type="text"
            className="form-control"
            value={novoCnpj}
            onChange={(e) => setNovoCnpj(e.target.value)}
            placeholder="Digite o CNPJ (somente números)"
          />
        </div>
        <div className="text-end">
          <button className="btn btn-success mt-2 px-4 py-2" onClick={handleAdicionarEmpresa}>
            <i className="fas fa-plus me-2"></i> Adicionar Empresa
          </button>
        </div>
      </div>

      <h3 className="section-title">Selecione as empresas:</h3>
      <div className="empresas-box">
        <table className="tabela-empresas">
          <thead>
            <tr>
              <th>
                <input type="checkbox" onChange={toggleTodas} checked={todasSelecionadas} />
              </th>
              <th>Razão Social</th>
              <th>CNPJ</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((empresa, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="checkbox"
                    value={empresa.cnpj}
                    checked={selecionadas.includes(empresa.cnpj)}
                    onChange={() => toggleSelecionada(empresa.cnpj)}
                  />
                </td>
                <td>{empresa.razaosocial}</td>
                <td>{empresa.cnpj}</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => handleExcluirEmpresa(empresa.cnpj)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="botoes-execucao">
        <button onClick={handleExecutar} disabled={executando} className="btn-executar">
          {executando ? 'Executando...' : 'Executar Integração'}
        </button>

        {executando && (
          <button
            onClick={handleCancelar}
            className="btn-cancelar"
            style={{ marginLeft: '1rem', backgroundColor: '#dc3545', color: '#fff' }}
          >
            Cancelar Execução
          </button>
        )}
      </div>

      {mensagem && (
        <div className="mensagem-status">
          <strong>Status:</strong><br />
          <pre style={{ whiteSpace: 'pre-wrap', color: mensagem.includes('⚠️') ? 'red' : 'inherit' }}>
            {mensagem}
          </pre>
        </div>
      )}
    </div>
  );
};

export default IntegraContador;
