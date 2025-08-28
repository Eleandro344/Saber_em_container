import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import '../styles/Contabilidade.css';

// ✅ Import do Recharts
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Contabilidade = () => {
  const [empresas, setEmpresas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [operadoresUnicos, setOperadoresUnicos] = useState([]);
  const [detalhesEmpresa, setDetalhesEmpresa] = useState(null);
  const [mostrarModalDetalhes, setMostrarModalDetalhes] = useState(false);

  // Função para normalizar o status (extrair apenas a primeira palavra)
  const normalizarStatus = (status) => {
    if (!status) return "Não definido";
    
    // Se o status contém parênteses, extrair apenas a parte antes do parêntese
    if (status.includes('(')) {
      return status.split('(')[0].trim();
    }
    
    return status;
  };

  // Função para formatar a data para competência
  const formatarCompetencia = (dataString) => {
    if (!dataString) return '-';
    
    try {
      // Para formato ISO "2024-12-31 00:00:00"
      if (dataString.includes('-')) {
        const [dataPart] = dataString.split(' ');
        const [ano, mes] = dataPart.split('-');
        return `${mes}/${ano.slice(2)}`;
      }
      
      // Para formato "31/12/2024 00:00"
      if (dataString.includes('/')) {
        const [dataPart] = dataString.split(' ');
        const [dia, mes, ano] = dataPart.split('/');
        return `${mes}/${ano.slice(2)}`;
      }
      
      return dataString;
    } catch (e) {
      console.error("Erro ao formatar data:", e);
      return dataString;
    }
  };

  // Determinar o nome do usuário
  const token = localStorage.getItem('access');
  let username = 'usuário';

  if (token) {
    try {
      const decoded = jwtDecode(token);
      username = decoded.first_name || decoded.username || decoded.sub || 'usuário';

      if (username === 'Amandacarissimi') username = 'Amanda Carissimi';
      else if (username === 'Matheusscheidt') username = 'Matheus Scheidt';
      else if (username === 'Maria') username = 'Maria Eduarda';
      else if (username === 'Juliana') username = 'Juliana Lino';
      else if (username === 'Leticia') username = 'Leticia Mohr';
      else if (username === 'Lucas') username = 'Lucas Petró de Oliveira';
      else if (username === 'Luisa') username = 'Luísa Brasil';
    } catch (e) {
      console.error('Erro ao decodificar token:', e);
    }
  }

  const [filtros, setFiltros] = useState({
    numero_dominio: '',
    empresa: '',
    drive_cliente: '',
    dt: '',
    ultima_entrega: '',
    proxima_entrega: '',
    regime: '',
    operador: username === 'usuário' ? '' : username,
    Status_contabil: '',
    tipo_entrega: '',
    controle_financeiro: ''
  });

  // Carregar empresas
  const carregarEmpresas = useCallback(() => {
    setCarregando(true);
    setMensagem('');

    const accessToken = localStorage.getItem('access');

    axios
      .get(`${process.env.REACT_APP_API_BASE}/api/empresas-contabil/`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .then((res) => {
        const empresasCarregadas = res.data.empresas || [];
        const operadoresUnicos = [...new Set(empresasCarregadas.map(emp => emp.operador).filter(Boolean))].sort();
        setOperadoresUnicos(operadoresUnicos);
        setEmpresas(empresasCarregadas);
        setCarregando(false);
      })
      .catch((error) => {
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

  // Filtro
  const empresasFiltradas = empresas.filter((emp) => {
    return Object.entries(filtros).every(([campo, valorFiltro]) => {
      if (!valorFiltro) return true;
      const valorEmpresa = emp[campo] ? emp[campo].toString().toLowerCase() : '';
      return valorEmpresa.includes(valorFiltro.toLowerCase());
    });
  });

  // ✅ Dados para o gráfico (agrupa por Status_contabil normalizado)
  const desempenhoOperador = React.useMemo(() => {
    if (!filtros.operador) return [];

    const dados = {};
    empresasFiltradas
      .filter(emp => emp.operador === filtros.operador)
      .forEach(emp => {
        const status = normalizarStatus(emp.Status_contabil);
        dados[status] = (dados[status] || 0) + 1;
      });

    return Object.entries(dados).map(([status, total]) => ({
      name: status,
      value: total
    }));
  }, [empresasFiltradas, filtros.operador]);


/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Abre o modal com os detalhes da empresa clicada
 * @param {Object} empresa - Objeto com os dados da empresa
/*******  50e06e80-816e-4117-a740-66c6fba59768  *******/
  const verDetalhesEmpresa = (empresa) => {
    const accessToken = localStorage.getItem('access');
    axios
      .get(`${process.env.REACT_APP_API_BASE}/api/detalhes-empresa/${empresa.numero_dominio}/`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .then((res) => {
        setDetalhesEmpresa(res.data.empresa);
        setMostrarModalDetalhes(true);
      })
      .catch(() => alert('Erro ao carregar detalhes da empresa'));
  };

  return (
    <div className="contabilidade-page">
      <div className="container mt-5 shadow p-4 rounded bg-white">
        {/* Cabeçalho */}
        <div className="header-wrapper d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center">
            <i className="fas fa-file-invoice header-icon me-2"></i>
            <h2 className="titulo-pagina m-0">Olá, {username}</h2>
          </div>
        </div>

        {mensagem && (
          <div className={`alert ${mensagem.includes('Erro') ? 'alert-danger' : 'alert-success'}`}>
            {mensagem}
          </div>
        )}

        {/* Filtro do Operador */}
        <div className="mb-3">
          <label className="form-label fw-bold">Operador</label>
          <select
            className="form-select"
            style={{ maxWidth: '300px' }}
            value={filtros.operador}
            onChange={(e) => setFiltros(prev => ({ ...prev, operador: e.target.value }))}
          >
            <option value="">Todos Operadores</option>
            {operadoresUnicos.map((operador) => (
              <option key={operador} value={operador}>
                {operador}
              </option>
            ))}
          </select>
        </div>

        {/* ✅ GRÁFICO DE DESEMPENHO SEMPRE VISÍVEL */}
        {filtros.operador && (
          <div className="mb-4 p-3 border rounded bg-light">
            <h5 className="mb-3 text-center">
              <i className="fas fa-chart-pie me-2"></i>
              Desempenho do Operador: {filtros.operador}
            </h5>
            <div className="d-flex justify-content-center">
              {desempenhoOperador.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={desempenhoOperador}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      innerRadius={70}
                      paddingAngle={4}
                      cornerRadius={10}
                      isAnimationActive={true}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      stroke="#fff"
                    >
                      {desempenhoOperador.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.name === "Concluído" || entry.name === "Em Dia"
                              ? "#28a745"
                              : entry.name === "Pendente" || entry.name === "Aguardando"
                              ? "#ffc107"
                              : entry.name === "Atrasado"
                              ? "#dc3545"
                              : "#6c757d"
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#343a40",
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      }}
                      formatter={(value, name) => [`${value}`, name]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconSize={14}
                      wrapperStyle={{
                        marginTop: "20px",
                        fontSize: "14px",
                        fontWeight: "500",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted mt-4">Nenhum dado disponível para este operador.</p>
              )}
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="table-responsive">
          {carregando ? (
            <div className="text-center mt-4">
              <div className="spinner-border" role="status"></div>
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
                      Ultima Entrega
                      <input
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filtrar..."
                        value={filtros.ultima_entrega}
                        onChange={(e) =>
                          setFiltros((prev) => ({ ...prev, ultima_entrega: e.target.value }))
                        }
                      />
                    </th>
                    <th>
                      Próxima Entrega
                      <input
                        type="text"
                        className="form-control form-control-sm mt-1"
                        placeholder="Filtrar..."
                        value={filtros.proxima_entrega}
                        onChange={(e) =>
                          setFiltros((prev) => ({ ...prev, proxima_entrega: e.target.value }))
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
                      <td>{empresa.ultima_entrega ? formatarCompetencia(empresa.ultima_entrega) : '-'}</td>
                      <td>{empresa.proxima_entrega || '-'}</td>
                      <td>{empresa.regime || '-'}</td>
                      <td>{empresa.operador || '-'}</td>
                      <td>
                        <span
                          className={`badge ${
                            empresa.Status_contabil === 'Concluído' || empresa.Status_contabil === 'Em Dia'
                              ? 'bg-success'
                              : empresa.Status_contabil === 'Pendente' || empresa.Status_contabil === 'Aguardando'
                              ? 'bg-warning'
                              : empresa.Status_contabil && empresa.Status_contabil.includes('Atrasado')
                              ? 'bg-danger'
                              : 'bg-secondary'
                          }`}
                        >
                          {empresa.Status_contabil || 'Não definido'}
                        </span>
                      </td>
                      <td>{empresa.tipo_entrega || '-'}</td>
                      <td>{empresa.controle_financeiro || '-'}</td>
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

      {/* Modal de Detalhes */}
      {mostrarModalDetalhes && detalhesEmpresa && (
        <div className="modal" tabIndex="-1" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Detalhes da Empresa</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setMostrarModalDetalhes(false)}
                ></button>
              </div>
              <div className="modal-body">
                <table className="table table-striped">
                  <tbody>
                    {Object.entries(detalhesEmpresa).map(([coluna, valor]) => (
                      <tr key={coluna}>
                        <th>{coluna}</th>
                        <td>
                          {coluna === 'ultima_entrega' && valor ? formatarCompetencia(valor) : 
                           (valor || '-')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setMostrarModalDetalhes(false)}
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
}

export default Contabilidade