import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import '../styles/Contabilidade.css';

// Imports do Recharts para ambos os gráficos
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip 
} from 'recharts';

const Contabilidade = () => {
  const [empresas, setEmpresas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [operadoresUnicos, setOperadoresUnicos] = useState([]);
  const [detalhesEmpresa, setDetalhesEmpresa] = useState(null);
  const [detalhesEditaveis, setDetalhesEditaveis] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvandoDetalhes, setSalvandoDetalhes] = useState(false);
  const [mostrarModalDetalhes, setMostrarModalDetalhes] = useState(false);
  const [mostrarModalEntregaParcial, setMostrarModalEntregaParcial] = useState(false);
  const [textoEntregaParcial, setTextoEntregaParcial] = useState('');
  
  // Estado para o modal de entrega
  const [mostrarModalEntrega, setMostrarModalEntrega] = useState(false);
  const [empresaSelecionada, setEmpresaSelecionada] = useState(null);
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState('');
  const [proximasCompetencias, setProximasCompetencias] = useState([]);
  const [entregaCarregando, setEntregaCarregando] = useState(false);
  
  // Estados para o histórico
  const [mostrarModalHistorico, setMostrarModalHistorico] = useState(false);
  const [historicoEntregas, setHistoricoEntregas] = useState([]);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  const [filtroHistorico, setFiltroHistorico] = useState('');

  // NOVOS ESTADOS PARA ENTREGA ATRASADA
  const [mostrarModalEntregaAtrasada, setMostrarModalEntregaAtrasada] = useState(false);
  const [textoEntregaAtrasada, setTextoEntregaAtrasada] = useState('');

  // Função para converter data para formato comparável
  const converterDataParaComparacao = (dataString) => {
    if (!dataString || dataString === '-') return new Date('1900-01-01');
    
    try {
      // Para formato DD/MM/YYYY
      if (dataString.includes('/')) {
        const [dia, mes, ano] = dataString.split('/');
        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      }
      
      // Para formato ISO
      if (dataString.includes('-')) {
        return new Date(dataString);
      }
      
      return new Date('1900-01-01');
    } catch (e) {
      return new Date('1900-01-01');
    }
  };

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

  // Função para carregar histórico de entregas
  const carregarHistorico = () => {
    setHistoricoCarregando(true);
    const accessToken = localStorage.getItem('access');

    axios
      .get(`${process.env.REACT_APP_API_BASE}/api/historico-contabil/`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .then((res) => {
        setHistoricoEntregas(res.data.historico || []);
        setHistoricoCarregando(false);
        setMostrarModalHistorico(true);
      })
      .catch((error) => {
        const errorMsg =
          error.response?.data?.erro ||
          error.response?.data?.mensagem ||
          error.message ||
          'Erro desconhecido ao carregar histórico';
        setMensagem(`Erro: ${errorMsg}`);
        setHistoricoCarregando(false);
      });
  };

  // Função para realizar entrega parcial
  const realizarEntregaParcial = () => {
    if (!empresaSelecionada || !competenciaSelecionada || !textoEntregaParcial.trim()) {
      setMensagem('Por favor, preencha o campo de observação para a entrega parcial.');
      return;
    }

    setEntregaCarregando(true);
    const accessToken = localStorage.getItem('access');

    const [mes, anoAbreviado] = competenciaSelecionada.split('/');
    const ano = `20${anoAbreviado}`;
    const dia = empresaSelecionada.dt ? Math.floor(empresaSelecionada.dt) : 30;
    const novaDataEntrega = `${dia.toString().padStart(2, '0')}/${mes}/${ano}`;

    axios
      .post(
        `${process.env.REACT_APP_API_BASE}/api/registrar-entrega-parcial/`,
        {
          numero_dominio: empresaSelecionada.numero_dominio,
          nova_data_entrega: novaDataEntrega,
          texto_entrega_parcial: textoEntregaParcial.trim()
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      )
      .then(() => {
        setMensagem(`Entrega parcial registrada com sucesso para a competência ${competenciaSelecionada}`);
        setMostrarModalEntregaParcial(false);
        setMostrarModalEntrega(false);
        setEntregaCarregando(false);
        setTextoEntregaParcial('');
        carregarEmpresas();
      })
      .catch((error) => {
        const errorMsg =
          error.response?.data?.erro ||
          error.response?.data?.mensagem ||
          error.message ||
          'Erro desconhecido ao registrar entrega parcial';
        setMensagem(`Erro: ${errorMsg}`);
        setEntregaCarregando(false);
      });
  };

  // NOVA FUNÇÃO PARA REALIZAR ENTREGA ATRASADA
  const realizarEntregaAtrasada = () => {
    if (!empresaSelecionada || !competenciaSelecionada || !textoEntregaAtrasada.trim()) {
      setMensagem('Por favor, preencha o campo de observação para a entrega atrasada.');
      return;
    }

    setEntregaCarregando(true);
    const accessToken = localStorage.getItem('access');

    const [mes, anoAbreviado] = competenciaSelecionada.split('/');
    const ano = `20${anoAbreviado}`;
    const dia = empresaSelecionada.dt ? Math.floor(empresaSelecionada.dt) : 30;
    const novaDataEntrega = `${dia.toString().padStart(2, '0')}/${mes}/${ano}`;

    axios
      .post(
        `${process.env.REACT_APP_API_BASE}/api/registrar-entrega-atrasada/`,
        {
          numero_dominio: empresaSelecionada.numero_dominio,
          nova_data_entrega: novaDataEntrega,
          texto_entrega_atrasada: textoEntregaAtrasada.trim()
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      )
      .then(() => {
        setMensagem(`Entrega atrasada registrada com sucesso para a competência ${competenciaSelecionada}`);
        setMostrarModalEntregaAtrasada(false);
        setEntregaCarregando(false);
        setTextoEntregaAtrasada('');
        carregarEmpresas();
      })
      .catch((error) => {
        const errorMsg =
          error.response?.data?.erro ||
          error.response?.data?.mensagem ||
          error.message ||
          'Erro desconhecido ao registrar entrega atrasada';
        setMensagem(`Erro: ${errorMsg}`);
        setEntregaCarregando(false);
      });
  };

  // Função ATUALIZADA para gerar próximas competências (12 meses a partir da última entrega)
  const gerarProximasCompetencias = (ultimaEntrega) => {
    const competencias = [];
    
    try {
      if (!ultimaEntrega) return competencias;
      
      // Extrair o mês e ano da última entrega
      let mes, ano;
      
      // Para formato "09/25" (MM/YY)
      if (ultimaEntrega.includes('/') && ultimaEntrega.length === 5) {
        const [mesStr, anoStr] = ultimaEntrega.split('/');
        mes = parseInt(mesStr);
        ano = parseInt("20" + anoStr); // Converte "25" para 2025
      }
      // Para formato ISO "2025-09-30 00:00:00"
      else if (ultimaEntrega.includes('-')) {
        const [dataPart] = ultimaEntrega.split(' ');
        const [anoStr, mesStr] = dataPart.split('-');
        mes = parseInt(mesStr);
        ano = parseInt(anoStr);
      }
      // Para formato "30/09/2025 00:00"
      else if (ultimaEntrega.includes('/') && ultimaEntrega.includes(' ')) {
        const [dataPart] = ultimaEntrega.split(' ');
        const [dia, mesStr, anoStr] = dataPart.split('/');
        mes = parseInt(mesStr);
        ano = parseInt(anoStr);
      }
      else {
        return competencias;
      }
      
      // Avançar para o próximo mês após a última entrega
      mes = mes + 1;
      if (mes > 12) {
        mes = 1;
        ano += 1;
      }
      
      // Gerar 12 competências a partir do mês seguinte à última entrega
      for (let i = 0; i < 12; i++) {
        const novoMes = ((mes - 1 + i) % 12) + 1; // Ajuste para 1-12
        const novoAno = ano + Math.floor((mes - 1 + i) / 12);
        const competencia = `${novoMes.toString().padStart(2, '0')}/${novoAno.toString().slice(-2)}`;
        competencias.push(competencia);
      }
    } catch (e) {
      console.error("Erro ao gerar competências:", e);
    }
    
    return competencias;
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
        // Converter dt para inteiro
        empresasCarregadas.forEach(emp => {
          if (emp.dt) {
            emp.dt = parseInt(emp.dt, 10);
          }
        });
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

  // FUNÇÃO ATUALIZADA PARA ABRIR MODAL DE ENTREGA
  const abrirModalEntrega = (empresa) => {
    setEmpresaSelecionada(empresa);
    
    // Usar a última entrega em vez da próxima entrega
    let ultimaEntregaFormatada = '';
    
    // Se tivermos a última entrega, formatamos para MM/YY
    if (empresa.ultima_entrega) {
      ultimaEntregaFormatada = formatarCompetencia(empresa.ultima_entrega);
    }
    
    const competencias = gerarProximasCompetencias(ultimaEntregaFormatada);
    setProximasCompetencias(competencias);
    setCompetenciaSelecionada(competencias[0] || '');
    
    // Verificar se a empresa está atrasada
    const estaAtrasada = empresa.Status_contabil && empresa.Status_contabil.toLowerCase().includes('atrasado');
    
    if (estaAtrasada) {
      // Se estiver atrasada, abrir modal específico para entrega atrasada
      setMostrarModalEntregaAtrasada(true);
    } else {
      // Se não estiver atrasada, abrir modal normal
      setMostrarModalEntrega(true);
    }
  };

  // Função para realizar a entrega
  const realizarEntrega = () => {
    if (!empresaSelecionada || !competenciaSelecionada) {
      return;
    }

    setEntregaCarregando(true);
    const accessToken = localStorage.getItem('access');

    // Converter a competência para o formato de data completa (dia/mes/ano)
    const [mes, anoAbreviado] = competenciaSelecionada.split('/');
    const ano = `20${anoAbreviado}`; // Assumindo formato de 2 dígitos para o ano
    const dia = empresaSelecionada.dt ? Math.floor(empresaSelecionada.dt) : 30;
    const novaDataEntrega = `${dia.toString().padStart(2, '0')}/${mes}/${ano}`;

    axios
      .post(
        `${process.env.REACT_APP_API_BASE}/api/registrar-entrega/`,
        {
          numero_dominio: empresaSelecionada.numero_dominio,
          nova_data_entrega: novaDataEntrega
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      )
      .then(() => {
        setMensagem(`Entrega registrada com sucesso para a competência ${competenciaSelecionada}`);
        setMostrarModalEntrega(false);
        setEntregaCarregando(false);
        // Recarregar empresas após o registro da entrega
        carregarEmpresas();
      })
      .catch((error) => {
        const errorMsg =
          error.response?.data?.erro ||
          error.response?.data?.mensagem ||
          error.message ||
          'Erro desconhecido ao registrar entrega';
        setMensagem(`Erro: ${errorMsg}`);
        setEntregaCarregando(false);
      });
  };

  // Filtro e ordenação
  const empresasFiltradas = empresas
    .filter((emp) => {
      return Object.entries(filtros).every(([campo, valorFiltro]) => {
        if (!valorFiltro) return true;
        const valorEmpresa = emp[campo] ? emp[campo].toString().toLowerCase() : '';
        return valorEmpresa.includes(valorFiltro.toLowerCase());
      });
    })
    .sort((a, b) => {
      // Ordenar pela próxima entrega (menor para maior)
      const dataA = converterDataParaComparacao(a.proxima_entrega);
      const dataB = converterDataParaComparacao(b.proxima_entrega);
      return dataA - dataB;
    });

  // Filtro para o histórico
  const historicoFiltrado = historicoEntregas.filter((item) => {
    if (!filtroHistorico) return true;
    
    const filtroLower = filtroHistorico.toLowerCase();
    return (
      item.empresa.toLowerCase().includes(filtroLower) ||
      item.entregue.toLowerCase().includes(filtroLower) ||
      item.numero_dominio.toString().includes(filtroLower) ||
      (item.texto_livre && item.texto_livre.toLowerCase().includes(filtroLower)) ||
      (item.tipo_entrega && item.tipo_entrega.toLowerCase().includes(filtroLower))
    );
  });

  // Dados para o gráfico de pizza (agrupa por Status_contabil normalizado)
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
  
  // Função para agrupar as próximas entregas por prazos
  const calcularEntregasPorPrazo = React.useMemo(() => {
    if (!empresasFiltradas.length || !filtros.operador) return [];
    
    // Filtrar apenas empresas do operador selecionado
    const empresasDoOperador = empresasFiltradas.filter(emp => emp.operador === filtros.operador);
    
    // Categorias de prazos (em dias)
    const categorias = [
      { label: "Atrasadas", min: -999, max: -1, color: "#dc3545" },
      { label: "Hoje", min: 0, max: 0, color: "#ffc107" },
      { label: "7 dias", min: 1, max: 7, color: "#17a2b8" },
      { label: "15 dias", min: 8, max: 15, color: "#28a745" },
      { label: "30 dias", min: 16, max: 30, color: "#6610f2" },
      { label: "+30 dias", min: 31, max: 999, color: "#6c757d" }
    ];
    
    // Inicializar contadores
    const contadores = categorias.map(cat => ({
      name: cat.label,
      value: 0,
      color: cat.color
    }));
    
    // Calcular dias até a próxima entrega para cada empresa
    empresasDoOperador.forEach(empresa => {
      if (!empresa.Status_contabil) return;
      
      let diasRestantes = null;
      
      // Extrair dias do status (formato: "Em Dia (X dias)" ou "Atrasado (X dias)")
      const match = empresa.Status_contabil.match(/\((\d+) dias\)/);
      if (match && match[1]) {
        diasRestantes = parseInt(match[1]);
        
        // Se está atrasado, converter para número negativo
        if (empresa.Status_contabil.toLowerCase().includes("atrasado")) {
          diasRestantes = -diasRestantes;
        }
        
        // Incrementar o contador na categoria apropriada
        for (let i = 0; i < categorias.length; i++) {
          const cat = categorias[i];
          if (diasRestantes >= cat.min && diasRestantes <= cat.max) {
            contadores[i].value++;
            break;
          }
        }
      }
    });
    
    // Filtrar apenas categorias com valores > 0
    return contadores.filter(item => item.value > 0);
  }, [empresasFiltradas, filtros.operador]);

  /**
   * Abre o modal com os detalhes da empresa clicada
   * @param {Object} empresa - Objeto com os dados da empresa
   */
  const verDetalhesEmpresa = (empresa) => {
    const accessToken = localStorage.getItem('access');
    axios
      .get(`${process.env.REACT_APP_API_BASE}/api/detalhes-empresa/${empresa.numero_dominio}/`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .then((res) => {
        setDetalhesEmpresa(res.data.empresa);
        setDetalhesEditaveis(res.data.empresa);
        setModoEdicao(false);
        setMostrarModalDetalhes(true);
      })
      .catch(() => alert('Erro ao carregar detalhes da empresa'));
  };
  
  // Função para atualizar os detalhes editáveis
  const handleDetalheChange = (campo, valor) => {
    setDetalhesEditaveis(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  // Função para salvar alterações nos detalhes
  const salvarDetalhes = () => {
    setSalvandoDetalhes(true);
    const accessToken = localStorage.getItem('access');

    axios
      .post(
        `${process.env.REACT_APP_API_BASE}/api/atualizar-empresa/${detalhesEmpresa.numero_dominio}/`,
        detalhesEditaveis,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      )
      .then((res) => {
        setDetalhesEmpresa(res.data.empresa);
        setDetalhesEditaveis(res.data.empresa);
        setModoEdicao(false);
        setSalvandoDetalhes(false);
        setMensagem('Dados da empresa atualizados com sucesso!');
        carregarEmpresas(); // Recarregar a lista de empresas para refletir as alterações
      })
      .catch((error) => {
        const errorMsg =
          error.response?.data?.erro ||
          error.response?.data?.mensagem ||
          error.message ||
          'Erro desconhecido ao atualizar empresa';
        setMensagem(`Erro: ${errorMsg}`);
        setSalvandoDetalhes(false);
      });
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
            <button 
              type="button" 
              className="btn-close float-end" 
              onClick={() => setMensagem('')}
            ></button>
          </div>
        )}

        {/* Filtro do Operador e Botões */}
        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label fw-bold">Operador</label>
            <select
              className="form-select"
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
          <div className="col-md-8 d-flex align-items-end gap-2">
            <button
              className="btn btn-outline-primary"
              onClick={carregarHistorico}
              disabled={historicoCarregando}
            >
              {historicoCarregando ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Carregando...
                </>
              ) : (
                <>
                  <i className="fas fa-history me-2"></i>
                  Ver Histórico de Entregas
                </>
              )}
            </button>
            
            <button
              className="btn btn-outline-success"
              onClick={() => window.location.href = '/Textolivre'}
            >
              <i className="fas fa-edit me-2"></i>
              Texto Livre
            </button>
          </div>
        </div>

        {/* GRÁFICOS DE DESEMPENHO */}
        {filtros.operador && (
          <div className="mb-4 p-3 border rounded bg-light">
            <h5 className="mb-3 text-center">
              <i className="fas fa-chart-pie me-2"></i>
              Desempenho do Operador: {filtros.operador}
            </h5>
            
            <div className="row">
              {/* Gráfico de Pizza - Status */}
              <div className="col-md-6">
                <h6 className="text-center mb-2">Distribuição de Status</h6>
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
                          backgroundColor: "#c2e03bff",
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
                  <p className="text-muted mt-4 text-center">Nenhum dado disponível para este operador.</p>
                )}
              </div>
              
              {/* Gráfico de Colunas - Prazos de Entregas */}
              <div className="col-md-6">
                <h6 className="text-center mb-2">Próximas Entregas por Prazo</h6>
                {calcularEntregasPorPrazo.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={calcularEntregasPorPrazo}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "#c1db2eff",
                          border: "none",
                          borderRadius: "8px",
                          color: "#fff",
                          boxShadow: "0 2px 8px rgba(214, 162, 66, 0.3)",
                        }}
                        formatter={(value) => [`${value} entregas`, 'Quantidade']}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {calcularEntregasPorPrazo.map((entry, index) => (
                          <Cell key={`bar-cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted mt-4 text-center">Nenhum prazo de entrega disponível.</p>
                )}
              </div>
            </div>
            
            <div className="row mt-3">
              <div className="col-12">
                <div className="d-flex justify-content-center gap-3 flex-wrap">
                  <small className="text-muted">
                    <span className="badge" style={{backgroundColor: "#dc3545"}}></span> Atrasadas
                  </small>
                  <small className="text-muted">
                    <span className="badge" style={{backgroundColor: "#ffc107"}}></span> Hoje
                  </small>
                  <small className="text-muted">
                    <span className="badge" style={{backgroundColor: "#17a2b8"}}></span> Próximos 7 dias
                  </small>
                  <small className="text-muted">
                    <span className="badge" style={{backgroundColor: "#28a745"}}></span> 8-15 dias
                  </small>
                  <small className="text-muted">
                    <span className="badge" style={{backgroundColor: "#6610f2"}}></span> 16-30 dias
                  </small>
                  <small className="text-muted">
                    <span className="badge" style={{backgroundColor: "#6c757d"}}></span> +30 dias
                  </small>
                </div>
              </div>
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
                <colgroup>
                  <col style={{ width: "40px" }} /> {/* Checkbox */}
                  <col /> {/* Nº Domínio */}
                  <col /> {/* Empresa */}
                  <col /> {/* Drive Cliente */}
                  <col /> {/* Ultima Entrega */}
                  <col /> {/* Próxima Entrega */}
                  <col /> {/* Regime */}
                  <col /> {/* Operador */}
                  <col /> {/* Status Contábil */}
                  <col /> {/* Tipo Entrega */}
                  <col /> {/* Controle Financeiro */}
                  <col style={{ width: "60px" }} /> {/* Ações */}
                </colgroup>
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
                      <div className="d-flex align-items-center justify-content-center">
                        Próxima Entrega
                        <i className="fas fa-sort-amount-down ms-2 text-primary" title="Ordenado do menor para o maior"></i>
                      </div>
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
                    <th style={{ width: "60px" }}>
                      Ações
                    </th>
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
                              title="Abrir Drive"
                            >
                              <i className="fas fa-external-link-alt"></i>
                            </button>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
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
                              : 'bg-success'
                          }`}
                          style={{ 
                            fontSize: '0.8rem',
                            fontWeight: 'light',
                            padding: '0.4em 0.6em'
                          }}
                        >
                          {empresa.Status_contabil || 'Não definido'}
                        </span>
                      </td>
                      <td>{empresa.tipo_entrega || '-'}</td>
                      <td>{empresa.controle_financeiro || '-'}</td>
                      <td style={{ width: "60px", padding: "2px" }}>
                        <div style={{ display: "flex", gap: "2px", justifyContent: "center" }}>
                          <button 
                            className="btn btn-sm btn-info" 
                            style={{ padding: "0.15rem 0.25rem", fontSize: "0.7rem" }}
                            onClick={() => verDetalhesEmpresa(empresa)}
                            title="Ver Detalhes"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button 
                            className="btn btn-sm btn-success" 
                            style={{ padding: "0.15rem 0.25rem", fontSize: "0.7rem" }}
                            onClick={() => abrirModalEntrega(empresa)}
                            title="Registrar Entrega"
                          >
                            <i className="fas fa-check-circle"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mostrando apenas total de registros filtrados */}
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

      {/* Modal de Detalhes com Edição */}
      {mostrarModalDetalhes && detalhesEmpresa && (
        <div className="modal" tabIndex="-1" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {modoEdicao ? "Editar Empresa" : "Detalhes da Empresa"}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setMostrarModalDetalhes(false)}
                  disabled={salvandoDetalhes}
                ></button>
              </div>
              <div className="modal-body">
                <div className="table-responsive">
                  <table className="table table-striped">
                    <tbody>
                      {Object.entries(detalhesEmpresa).map(([coluna, valor]) => {
                        // Campos que não podem ser editados
                        const camposProtegidos = [
                          'ultima_entrega', 
                          'proxima_entrega', 
                          'id', 
                          'numero_dominio', 
                          'Status_contabil', 
                          'dias_atraso'
                        ];
                        
                        const editavel = !camposProtegidos.includes(coluna);
                        
                        return (
                          <tr key={coluna}>
                            <th>{coluna}</th>
                            <td>
                              {modoEdicao && editavel ? (
                                // Campo editável
                                coluna === 'operador' ? (
                                  // Select para operadores
                                  <select 
                                    className="form-select form-select-sm"
                                    value={detalhesEditaveis[coluna] || ''}
                                    onChange={(e) => handleDetalheChange(coluna, e.target.value)}
                                  >
                                    <option value="">Selecione um operador</option>
                                    {operadoresUnicos.map((op) => (
                                      <option key={op} value={op}>{op}</option>
                                    ))}
                                  </select>
                                ) : coluna === 'tipo_entrega' ? (
                                  // Select para tipo de entrega
                                  <select 
                                    className="form-select form-select-sm"
                                    value={detalhesEditaveis[coluna] || ''}
                                    onChange={(e) => handleDetalheChange(coluna, e.target.value)}
                                  >
                                    <option value="">Selecione o tipo</option>
                                    <option value="Anual">Anual</option>
                                    <option value="Mensal">Mensal</option>
                                    <option value="Trimestral">Trimestral</option>
                                    <option value="Semestral">Semestral</option>
                                  </select>
                                ) : coluna === 'regime' ? (
                                  // Select para regime
                                  <select 
                                    className="form-select form-select-sm"
                                    value={detalhesEditaveis[coluna] || ''}
                                    onChange={(e) => handleDetalheChange(coluna, e.target.value)}
                                  >
                                    <option value="">Selecione o regime</option>
                                    <option value="LP">Lucro Presumido</option>
                                    <option value="LR">Lucro Real</option>
                                    <option value="SN">Simples Nacional</option>
                                  </select>
                                ) : coluna === 'controle_financeiro' ? (
                                  // Select para controle financeiro
                                  <select 
                                    className="form-select form-select-sm"
                                    value={detalhesEditaveis[coluna] || ''}
                                    onChange={(e) => handleDetalheChange(coluna, e.target.value)}
                                  >
                                    <option value="">Selecione</option>
                                    <option value="Sim">Sim</option>
                                    <option value="Não">Não</option>
                                    <option value="Não tem">Não tem</option>
                                  </select>
                                ) : coluna === 'dt' ? (
                                  // Input para dia
                                  <input 
                                    type="number" 
                                    className="form-control form-control-sm"
                                    value={detalhesEditaveis[coluna] || ''}
                                    onChange={(e) => handleDetalheChange(coluna, e.target.value)}
                                    min="1"
                                    max="31"
                                  />
                                ) : (
                                  // Input para outros campos
                                  <input 
                                    type="text" 
                                    className="form-control form-control-sm"
                                    value={detalhesEditaveis[coluna] || ''}
                                    onChange={(e) => handleDetalheChange(coluna, e.target.value)}
                                  />
                                )
                              ) : (
                                // Visualização (não editável)
                                coluna === 'ultima_entrega' && valor ? formatarCompetencia(valor) : 
                                (valor || '-')
                              )}
                              
                              {/* Badge para campos protegidos quando no modo edição */}
                              {modoEdicao && !editavel && (
                                <span className="badge bg-secondary ms-2">Não editável</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                {modoEdicao ? (
                  <>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setModoEdicao(false);
                        setDetalhesEditaveis(detalhesEmpresa); // Restaurar valores originais
                      }}
                      disabled={salvandoDetalhes}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary"
                      onClick={salvarDetalhes}
                      disabled={salvandoDetalhes}
                    >
                      {salvandoDetalhes ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Salvando...
                        </>
                      ) : (
                        'Salvar Alterações'
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => setModoEdicao(true)}
                    >
                      <i className="fas fa-edit me-2"></i>
                      Editar
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => setMostrarModalDetalhes(false)}
                    >
                      Fechar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico ATUALIZADO */}
      {mostrarModalHistorico && (
        <div className="modal" tabIndex="-1" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog" style={{ maxWidth: '95vw', width: '95vw' }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-history me-2"></i>
                  Histórico de Entregas
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setMostrarModalHistorico(false);
                    setFiltroHistorico('');
                  }}
                ></button>
              </div>
              <div className="modal-body">
                {/* Campo de filtro do histórico */}
                <div className="mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Filtrar por empresa, competência, domínio, tipo ou observação..."
                    value={filtroHistorico}
                    onChange={(e) => setFiltroHistorico(e.target.value)}
                  />
                </div>

                <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table className="table table-striped table-hover">
                    <thead className="table-dark sticky-top">
                      <tr>
                        <th style={{ minWidth: '160px' }}>Data/Hora</th>
                        <th style={{ minWidth: '280px' }}>Empresa</th>
                        <th style={{ minWidth: '110px' }}>Competência</th>
                        <th style={{ minWidth: '100px' }}>Nº Domínio</th>
                        <th style={{ minWidth: '100px' }}>Tipo</th>
                        <th style={{ minWidth: '300px' }}>Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoFiltrado.length > 0 ? (
                        historicoFiltrado.map((item) => (
                          <tr key={item.id}>
                            <td style={{ minWidth: '160px', fontSize: '0.85rem' }}>{item.data_hoje}</td>
                            <td style={{ minWidth: '280px', fontSize: '0.9rem' }} className="fw-semibold">{item.empresa}</td>
                            <td style={{ minWidth: '110px', fontSize: '0.9rem' }} className="text-center">
                              <span className="badge bg-primary">{item.entregue}</span>
                            </td>
                            <td style={{ minWidth: '100px', fontSize: '0.9rem' }} className="text-center">{item.numero_dominio}</td>
                            <td style={{ minWidth: '100px', fontSize: '0.9rem' }} className="text-center">
                              <span 
                                className={`badge ${
                                  item.tipo_entrega === 'Parcial' 
                                    ? 'bg-warning text-dark' 
                                    : item.tipo_entrega === 'Atrasada'
                                    ? 'bg-danger'
                                    : 'bg-success'
                                }`}
                              >
                                {item.tipo_entrega || 'Completa'}
                              </span>
                            </td>
                            <td style={{ minWidth: '300px', fontSize: '0.9rem' }}>
                              {item.texto_livre ? (
                                <div className={`${item.tipo_entrega === 'Atrasada' ? 'text-danger' : 'text-info'}`}>
                                  <i className={`fas ${item.tipo_entrega === 'Atrasada' ? 'fa-exclamation-triangle' : 'fa-comment-dots'} me-2`}></i>
                                  <span className="fst-italic">{item.texto_livre}</span>
                                  {item.tipo_entrega === 'Atrasada' && (
                                    <small className="d-block text-muted mt-1">
                                      <i className="fas fa-clock me-1"></i>
                                      Motivo do atraso
                                    </small>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted">
                                  <i className="fas fa-minus me-2"></i>
                                  Sem observações
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center text-muted py-4">
                            {filtroHistorico ? 'Nenhum registro encontrado com esse filtro.' : 'Nenhum histórico disponível.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    Total de registros: <strong>{historicoFiltrado.length}</strong>
                  </small>
                  <div className="d-flex gap-3">
                    <small className="text-muted">
                      <span className="badge bg-success me-1"></span>
                      Completa
                    </small>
                    <small className="text-muted">
                      <span className="badge bg-warning text-dark me-1"></span>
                      Parcial
                    </small>
                    <small className="text-muted">
                      <span className="badge bg-danger me-1"></span>
                      Atrasada
                    </small>
                  </div>
                  <small className="text-muted">
                    Últimos 1000 registros ordenados por data mais recente
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setMostrarModalHistorico(false);
                    setFiltroHistorico('');
                  }}
                >
                  <i className="fas fa-times me-2"></i>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Entrega */}
      {mostrarModalEntrega && empresaSelecionada && (
        <div className="modal" tabIndex="-1" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Registrar Entrega</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setMostrarModalEntrega(false)}
                  disabled={entregaCarregando}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <p><strong>Empresa:</strong> {empresaSelecionada.empresa}</p>
                  <p><strong>Última Entrega:</strong> {formatarCompetencia(empresaSelecionada.ultima_entrega)}</p>
                  <p><strong>Próxima Entrega:</strong> {empresaSelecionada.proxima_entrega}</p>
                </div>
                
                <div className="mb-3">
                  <label className="form-label">Selecione a competência para entrega:</label>
                  <select 
                    className="form-select"
                    value={competenciaSelecionada}
                    onChange={(e) => setCompetenciaSelecionada(e.target.value)}
                    disabled={entregaCarregando}
                  >
                    {proximasCompetencias.map((comp) => (
                      <option key={comp} value={comp}>{comp}</option>
                    ))}
                  </select>
                </div>
                
                <div className="text-muted small">
                  <p>
                    Ao registrar a entrega, a data da última entrega será atualizada para a competência selecionada.
                  </p>
                </div>
              </div>
              <div className="modal-footer d-flex justify-content-between">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setMostrarModalEntrega(false)}
                  disabled={entregaCarregando}
                >
                  Cancelar
                </button>
                <div>
                  <button 
                    type="button" 
                    className="btn btn-warning me-2"
                    onClick={() => setMostrarModalEntregaParcial(true)}
                    disabled={entregaCarregando}
                  >
                    Entrega Parcial
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={realizarEntrega}
                    disabled={!competenciaSelecionada || entregaCarregando}
                  >
                    {entregaCarregando ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Processando...
                      </>
                    ) : (
                      'Confirmar Entrega'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NOVO Modal de Entrega Atrasada */}
      {mostrarModalEntregaAtrasada && empresaSelecionada && (
        <div className="modal" tabIndex="-1" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h5 className="modal-title">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  Entrega em Atraso
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setMostrarModalEntregaAtrasada(false);
                    setTextoEntregaAtrasada('');
                  }}
                  disabled={entregaCarregando}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-warning">
                  <i className="fas fa-exclamation-circle me-2"></i>
                  <strong>Atenção:</strong> Esta empresa está com entrega em atraso. 
                  É obrigatório informar o motivo do atraso.
                </div>
                
                <div className="mb-3">
                  <p><strong>Empresa:</strong> {empresaSelecionada.empresa}</p>
                  <p><strong>Status:</strong> 
                    <span className="badge bg-danger ms-2">{empresaSelecionada.Status_contabil}</span>
                  </p>
                  <p><strong>Próxima Entrega:</strong> {empresaSelecionada.proxima_entrega}</p>
                </div>
                
                <div className="mb-3">
                  <label className="form-label">Selecione a competência para entrega:</label>
                  <select 
                    className="form-select"
                    value={competenciaSelecionada}
                    onChange={(e) => setCompetenciaSelecionada(e.target.value)}
                    disabled={entregaCarregando}
                  >
                    {proximasCompetencias.map((comp) => (
                      <option key={comp} value={comp}>{comp}</option>
                    ))}
                  </select>
                </div>
                
                <div className="mb-3">
                  <label className="form-label">
                    <strong>Motivo do Atraso:</strong>
                    <span className="text-danger">*</span>
                  </label>
                  <textarea 
                    className="form-control"
                    rows="4"
                    placeholder="Descreva o motivo do atraso na entrega (ex: documentos em atraso do cliente, problemas técnicos, etc.)"
                    value={textoEntregaAtrasada}
                    onChange={(e) => setTextoEntregaAtrasada(e.target.value)}
                    disabled={entregaCarregando}
                    maxLength="500"
                  />
                  <small className="text-muted">
                    {textoEntregaAtrasada.length}/500 caracteres
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setMostrarModalEntregaAtrasada(false);
                    setTextoEntregaAtrasada('');
                  }}
                  disabled={entregaCarregando}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-warning"
                  onClick={realizarEntregaAtrasada}
                  disabled={!textoEntregaAtrasada.trim() || entregaCarregando}
                >
                  {entregaCarregando ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Processando...
                    </>
                  ) : (
                    'Confirmar Entrega Atrasada'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Entrega Parcial */}
      {mostrarModalEntregaParcial && (
        <div className="modal" tabIndex="-1" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Entrega Parcial</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setMostrarModalEntregaParcial(false);
                    setTextoEntregaParcial('');
                  }}
                  disabled={entregaCarregando}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <p><strong>Empresa:</strong> {empresaSelecionada?.empresa}</p>
                  <p><strong>Competência:</strong> {competenciaSelecionada}</p>
                </div>
                
                <div className="mb-3">
                  <label className="form-label">
                    <strong>Observação da Entrega Parcial:</strong>
                    <span className="text-danger">*</span>
                  </label>
                  <textarea 
                    className="form-control"
                    rows="4"
                    placeholder="Descreva o que foi entregue parcialmente (ex: documentos enviados, DRE pendente, etc.)"
                    value={textoEntregaParcial}
                    onChange={(e) => setTextoEntregaParcial(e.target.value)}
                    disabled={entregaCarregando}
                    maxLength="500"
                  />
                  <small className="text-muted">
                    {textoEntregaParcial.length}/500 caracteres
                  </small>
                </div>
                
                <div className="alert alert-info">
                  <i className="fas fa-info-circle me-2"></i>
                  <strong>Atenção:</strong> A entrega parcial registrará o progresso da competência, 
                  mas manterá o status como em andamento. Descreva claramente o que foi entregue.
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setMostrarModalEntregaParcial(false);
                    setTextoEntregaParcial('');
                  }}
                  disabled={entregaCarregando}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-warning"
                  onClick={realizarEntregaParcial}
                  disabled={!textoEntregaParcial.trim() || entregaCarregando}
                >
                  {entregaCarregando ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Processando...
                    </>
                  ) : (
                    'Confirmar Entrega Parcial'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contabilidade;