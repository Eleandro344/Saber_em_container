import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode'; // Certifique-se de instalar jwt-decode
import '../styles/Contabilidade.css';

const Contabilidade = () => {
  const [empresas, setEmpresas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [operadoresUnicos, setOperadoresUnicos] = useState([]);
  const [mostrarModalDesempenho, setMostrarModalDesempenho] = useState(false); // Novo estado para modal de desempenho

  // Determinar o nome do usuário
  const token = localStorage.getItem('access');
  let username = 'usuário';

  console.log('TOKEN:', token);
  if (token) {
    try {
      const decoded = jwtDecode(token);
      console.log('DECODED JWT:', decoded);

      username = decoded.first_name || decoded.username || decoded.sub || 'usuário';

      // 👇 Ajuste manual de nomes específicos
      if (username === 'Amandacarissimi') {
        username = 'Amanda Carissimi';
      } else if (username === 'Matheusscheidt') {
        username = 'Matheus Scheidt';
      } else if (username === 'Maria') {
        username = 'Maria Eduarda';
      } else if (username === 'Juliana') {
        username = 'Juliana Lino';
      } else if (username === 'Leticia') {
        username = 'Leticia Mohr';      
      } else if (username === 'Lucas') {
        username = 'Lucas Petró de Oliveira';    
      } else if (username === 'Luisa') {
        username = 'Luísa Brasil';     
      }
    } catch (e) {
      console.error('Erro ao decodificar token:', e);
    }
  }

  const [filtros, setFiltros] = useState({
    numero_dominio: '',
    empresa: '',
    drive_cliente: '',
    dt: '',
    regime: '',
    operador: username === 'usuário' ? '' : username, // Aplicar filtro automático
    Status_contabil: '',
    tipo_entrega: '',
    controle_financeiro: ''
  });

  // Função para carregar empresas
  const carregarEmpresas = useCallback(() => {
    setCarregando(true);
    setMensagem('');

    const accessToken = localStorage.getItem('access');

    axios
      .get(`${process.env.REACT_APP_API_BASE}/api/empresas-contabil/`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then((res) => {
        console.log('Resposta completa:', res.data);
        const empresasCarregadas = res.data.empresas || [];
        
        // Atualizar lista de operadores
        const operadoresUnicos = [...new Set(empresasCarregadas.map(emp => emp.operador).filter(Boolean))].sort();
        setOperadoresUnicos(operadoresUnicos);

        setEmpresas(empresasCarregadas);
        setCarregando(false);
      })
      .catch((error) => {
        console.error('Erro ao carregar empresas:', error);

        const errorMsg =
          error.response?.data?.erro ||
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

  const handleCheckbox = (numero_dominio) => {
    setSelecionadas((prev) =>
      prev.includes(numero_dominio)
        ? prev.filter((item) => item !== numero_dominio)
        : [...prev, numero_dominio]
    );
  };

  const selecionarTodas = () => {
    if (selecionadas.length === empresasFiltradas.length) {
      setSelecionadas([]);
    } else {
      setSelecionadas(empresasFiltradas.map((emp) => emp.numero_dominio));
    }
  };

  // ✅ Filtro corrigido
  const empresasFiltradas = empresas.filter((emp) => {
    return Object.entries(filtros).every(([campo, valorFiltro]) => {
      // Se não há valor de filtro, passa
      if (!valorFiltro) return true;

      // Converter para string e lowercase para comparação
      const valorEmpresa = emp[campo] ? emp[campo].toString().toLowerCase() : '';
      const valorFiltroLower = valorFiltro.toLowerCase();

      // Verificar se o valor do filtro está contido no valor da empresa
      return valorEmpresa.includes(valorFiltroLower);
    });
  });

  // ✅ Função para copiar link
  const copiarLink = (link) => {
    if (!link) {
      alert('Nenhum link disponível');
      return;
    }
    navigator.clipboard.writeText(link);
    alert('Link copiado para a área de transferência!');
  };

  // Nova função para detalhes da empresa
  const verDetalhesEmpresa = (empresa) => {
    console.log('Detalhes da empresa:', empresa);
    // Futuramente aqui será implementado o modal ou página de detalhes
  };

  // Nova função para abrir o modal de desempenho
  const abrirModalDesempenho = () => {
    setMostrarModalDesempenho(true);
  };

  return (
    <div className="contabilidade-page">
      <div className="container mt-5 shadow p-4 rounded bg-white">
        <div className="header-wrapper d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center">
            <i className="fas fa-file-invoice header-icon me-2"></i>
            <h2 className="titulo-pagina m-0">Olá, {username}</h2>
          </div>
        </div>

        {mensagem && (
          <div
            className={`alert ${
              mensagem.includes('Erro') ? 'alert-danger' : 'alert-success'
            }`}
          >
            {mensagem}
          </div>
        )}

        {/* Novo filtro de operadores */}
        {/* Dentro do div com classe d-flex gap-2 mb-3 */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          {/* Filtro de operadores (mantido como estava) */}
          <div className="d-flex gap-2">
            <div>
              <label className="form-label fw-bold">Operador</label>
              <select
                className="form-select"
                value={filtros.operador}
                onChange={(e) => 
                  setFiltros(prev => ({ 
                    ...prev, 
                    operador: e.target.value 
                  }))
                }
              >
                <option value="">Todos Operadores</option>
                {operadoresUnicos.map((operador) => (
                  <option key={operador} value={operador}>
                    {operador}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Novo botão de Desempenho */}
          <div>
            <button 
              className="btn btn-primary"
              onClick={abrirModalDesempenho}
            >
              <i className="fas fa-chart-line me-2"></i>
              Ver Desempenho
            </button>
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
            <>
              <table className="table table-bordered table-hover text-center align-middle fs-6">
                <thead className="table-light">
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          selecionadas.length === empresasFiltradas.length &&
                          empresasFiltradas.length > 0
                        }
                        onChange={selecionarTodas}
                      />
                    </th>
                    <th>
                      Nº Domínio
                      <input
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filtrar..."
                        value={filtros.numero_dominio}
                        onChange={(e) =>
                          setFiltros((prev) => ({
                            ...prev,
                            numero_dominio: e.target.value
                          }))
                        }
                      />
                    </th>
                    <th>
                      Empresa
                      <input
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filtrar..."
                        value={filtros.empresa}
                        onChange={(e) =>
                          setFiltros((prev) => ({
                            ...prev,
                            empresa: e.target.value
                          }))
                        }
                      />
                    </th>
                    <th>
                      Drive Cliente
                      <input
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filtrar..."
                        value={filtros.drive_cliente}
                        onChange={(e) =>
                          setFiltros((prev) => ({
                            ...prev,
                            drive_cliente: e.target.value
                          }))
                        }
                      />
                    </th>
                    <th>
                      Data
                      <input
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filtrar..."
                        value={filtros.dt}
                        onChange={(e) =>
                          setFiltros((prev) => ({ ...prev, dt: e.target.value }))
                        }
                      />
                    </th>
                    <th>
                      Regime
                      <input
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filtrar..."
                        value={filtros.regime}
                        onChange={(e) =>
                          setFiltros((prev) => ({
                            ...prev,
                            regime: e.target.value
                          }))
                        }
                      />
                    </th>
                    <th>
                      Operador
                      <input
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filtrar..."
                        value={filtros.operador}
                        onChange={(e) =>
                          setFiltros((prev) => ({
                            ...prev,
                            operador: e.target.value
                          }))
                        }
                      />
                    </th>
                    <th>
                      Status Contábil
                      <input
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filtrar..."
                        value={filtros.Status_contabil}
                        onChange={(e) =>
                          setFiltros((prev) => ({
                            ...prev,
                            Status_contabil: e.target.value
                          }))
                        }
                      />
                    </th>
                    <th>
                      Tipo Entrega
                      <input
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filtrar..."
                        value={filtros.tipo_entrega}
                        onChange={(e) =>
                          setFiltros((prev) => ({
                            ...prev,
                            tipo_entrega: e.target.value
                          }))
                        }
                      />
                    </th>
                    <th>
                      Controle Financeiro
                      <input
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filtrar..."
                        value={filtros.controle_financeiro}
                        onChange={(e) =>
                          setFiltros((prev) => ({
                            ...prev,
                            controle_financeiro: e.target.value
                          }))
                        }
                      />
                    </th>
                    {/* Nova coluna de Detalhes */}
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {empresasFiltradas.map((empresa) => (
                    <tr key={empresa.numero_dominio}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selecionadas.includes(
                            empresa.numero_dominio
                          )}
                          onChange={() =>
                            handleCheckbox(empresa.numero_dominio)
                          }
                        />
                      </td>
                      <td>{empresa.numero_dominio}</td>
                      <td className="text-start">{empresa.empresa}</td>
                      <td>
                        {empresa.drive_cliente ? (
                          <>
                            <button
                              className="btn btn-sm btn-outline-primary me-1"
                              onClick={() => copiarLink(empresa.drive_cliente)}
                            >
                              Copiar
                            </button>
                            <button
                              className="btn btn-sm btn-outline-success"
                              onClick={() =>
                                window.open(empresa.drive_cliente, '_blank')
                              }
                            >
                              Abrir
                            </button>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{empresa.dt || '-'}</td>
                      <td>{empresa.regime || '-'}</td>
                      <td>{empresa.operador || '-'}</td>
                      <td>
                        <span
                          className={`badge ${
                            empresa.Status_contabil === 'Concluído'
                              ? 'bg-success'
                              : empresa.Status_contabil === 'Pendente'
                              ? 'bg-warning'
                              : empresa.Status_contabil === 'Em Dia'
                              ? 'bg-success'
                              : empresa.Status_contabil === 'Aguardando'
                              ? 'bg-warning'
                              : empresa.Status_contabil === 'Atrasado'
                              ? 'bg-danger'
                              : 'bg-secondary'
                          }`}
                        >
                          {empresa.Status_contabil || 'Não definido'}
                        </span>
                      </td>
                      <td>{empresa.tipo_entrega || '-'}</td>
                      <td>{empresa.controle_financeiro || '-'}</td>
                      {/* Nova coluna de Detalhes */}
                      <td>
                        <button 
                          className="btn btn-sm btn-info"
                          onClick={() => verDetalhesEmpresa(empresa)}
                        >
                          Ver Mais
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ✅ Mostrando apenas total de registros filtrados */}
              <div className="mt-3 text-end">
                <span className="text-muted">
                  Total de registros encontrados: {empresasFiltradas.length}
                </span>
              </div>
            </>
          )}

          {!carregando && empresasFiltradas.length === 0 && (
            <div className="text-center mt-4">
              <p className="text-muted">Nenhuma empresa encontrada.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Desempenho */}
      {mostrarModalDesempenho && (
        <div className="modal" tabIndex="-1" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Desempenho</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setMostrarModalDesempenho(false)}
                ></button>
              </div>
              <div className="modal-body">
                {/* Conteúdo do desempenho */}
                <p>Relatório de desempenho será implementado</p>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setMostrarModalDesempenho(false)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contabilidade;