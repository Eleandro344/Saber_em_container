import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/dividas.css';

// Modal para visualizar e editar e-mail antes de enviar
const EmailPreviewModal = ({ show, handleClose, emailData, handleSendEmail }) => {
  const [destinatario, setDestinatario] = useState('');
  // Email fixo em cópia
  const emailCopia = 'fiscal@gerencialconsultoria.com.br';
  const [assunto, setAssunto] = useState('DIVIDAS PENDENTES');
  const [corpoHtml, setCorpoHtml] = useState('');
  
  useEffect(() => {
    if (emailData) {
      // Gerar tabela de dívidas HTML
      let dividasHtml = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
          <thead style="background-color: #f0f0f0;">
            <tr>
              <th>Código</th>
              <th>Período</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      emailData.dividas.forEach(divida => {
        const valorFormatado = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(divida.saldo_devedor);
        
        dividasHtml += `
          <tr>
            <td>${divida.codigo}</td>
            <td>${divida.periodo}</td>
            <td style="text-align: right;">${valorFormatado}</td>
            <td>${divida.vencimento}</td>
            <td>${divida.situacao}</td>
          </tr>
        `;
      });
      
      dividasHtml += `
          </tbody>
        </table>
      `;
      
      // Formatar valor total
      const totalFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(emailData.total_dividas);
      
      // Usar URL pública para o logo
      const logoUrl = 'https://comecehub.com.br/wp-content/uploads/2021/05/logoemail.png';
      
      // Criar corpo do e-mail completo
      const corpo = `
      <html>
      <head>
          <meta charset="UTF-8">
          <style>
              body {
                  font-family: Arial, sans-serif;
                  font-size: 16px;
                  color: #333;
                  background-color: #f9f9f9;
                  padding: 20px;
              }
              h2 {
                  color: #0073e6;
              }
              .header {
                  margin-bottom: 20px;
              }
              .table-container {
                  margin: 20px 0;
              }
              .summary {
                  background-color: #f0f0f0;
                  padding: 10px;
                  border-radius: 5px;
                  margin-bottom: 20px;
              }
              .footer {
                  margin-top: 30px;
                  border-top: 1px solid #ddd;
                  padding-top: 15px;
              }
          </style>
      </head>
      
      <body>
          <div class="header">
              <p>Olá ${emailData.empresa},</p>
              <p>Estamos entrando em contato para informar sobre as pendências tributárias identificadas nos sistemas da Receita Federal, através de consulta à Situação Fiscal.</p>
          </div>
          
          <div class="summary">
              <p><strong>CNPJ:</strong> ${emailData.cnpj}</p>
              <p><strong>Total Pendente:</strong> ${totalFormatado}</p>
              <p><strong>Quantidade de Dívidas:</strong> ${emailData.dividas.length}</p>
          </div>
          
          <h3>Detalhamento das Dívidas:</h3>
          <div class="table-container">
              ${dividasHtml}
          </div>
          
          <p>As pendências em questão, se não forem quitadas ou parceladas, sofrem correção monetária diariamente, aumentando o passivo financeiro da empresa.</p>
          
          <p>Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem ou nos envie o comprovante para atualizações em nosso sistema.</p>
          <p>Se precisar de informações mais detalhadas ou falar a respeito de opções de parcelamentos, entre em contato com o nosso time através do email fiscal@gerencialconsultoria.com.br.</p>

          <div class="footer">
              <p>Qualquer dúvida, estou à disposição.</p>
              <p>Atenciosamente,</p>
              <img src="${logoUrl}" alt="Logo Comece" style="width: 300px; height: auto; display: block; margin: 0;">
          </div>
      </body>
      </html>
      `;
      
      setCorpoHtml(corpo);
    }
  }, [emailData]);

  return (
    <div className="modal show d-block" tabIndex="-1">
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Pré-visualização de E-mail</h5>
            <button type="button" className="btn-close" onClick={handleClose}></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label htmlFor="destinatario" className="form-label">Destinatário:</label>
              <input 
                type="email" 
                className="form-control" 
                id="destinatario" 
                value={destinatario} 
                onChange={(e) => setDestinatario(e.target.value)}
                placeholder="email@empresa.com"
              />
            </div>
            <div className="mb-3">
              <label htmlFor="emailCopia" className="form-label">E-mail em Cópia (CC):</label>
              <input 
                type="email" 
                className="form-control" 
                id="emailCopia" 
                value={emailCopia} 
                disabled
              />
            </div>
            <div className="mb-3">
              <label htmlFor="assunto" className="form-label">Assunto:</label>
              <input 
                type="text" 
                className="form-control" 
                id="assunto" 
                value={assunto} 
                onChange={(e) => setAssunto(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Conteúdo:</label>
              <div 
                className="border p-3" 
                style={{height: '400px', overflowY: 'auto'}}
                dangerouslySetInnerHTML={{ __html: corpoHtml }}
              ></div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancelar</button>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={() => handleSendEmail(destinatario, emailCopia, assunto, corpoHtml)}
              disabled={!destinatario}
            >
              <i className="fas fa-paper-plane me-2"></i>
              Enviar E-mail
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" onClick={handleClose}></div>
    </div>
  );
};

// Componente do modal para clientes com dívidas no mês atual
const ClientesComDividaMes = ({ show, handleClose, dividas }) => {
  // Estado para controlar a expansão das linhas
  const [expandedRows, setExpandedRows] = useState({});
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedClienteEmail, setSelectedClienteEmail] = useState(null);
  // Estado para rastrear os emails enviados
  const [emailsEnviados, setEmailsEnviados] = useState({});
  
  // Recuperar informações de emails enviados do localStorage na inicialização
  useEffect(() => {
    const savedEmails = localStorage.getItem('emailsDividasEnviados');
    if (savedEmails) {
      try {
        setEmailsEnviados(JSON.parse(savedEmails));
      } catch (e) {
        console.error("Erro ao carregar emails enviados:", e);
      }
    }
  }, []);
  
  // Filtra e agrupa clientes com dívidas no mês atual
  const clientesAgrupados = useMemo(() => {
    if (!dividas || dividas.length === 0) return [];

    // 1. Converte todas as datas para objetos Date
    const datasValidas = dividas
      .filter(divida => divida.data_registro)
      .map(divida => {
        const [dia, mes, ano] = divida.data_registro.split('/');
        return new Date(ano, mes - 1, dia);
      });

    // 2. Pega a data mais recente
    const ultimaData = datasValidas.sort((a, b) => b - a)[0];

    // 3. Formata a data de volta para 'dd/mm/yyyy'
    const formatarData = (data) => {
      const dia = String(data.getDate()).padStart(2, '0');
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const ano = data.getFullYear();
      return `${dia}/${mes}/${ano}`;
    };

    const dataMaisRecente = formatarData(ultimaData);

    // 4. Filtra apenas dívidas com essa data e situação 'devedor'
    const dividasFiltradas = dividas.filter(divida =>
      divida.situacao?.toLowerCase() === 'devedor' &&
      divida.data_registro === dataMaisRecente
    );

    // 5. Agrupa por CNPJ
    const clientesMap = {};

    dividasFiltradas.forEach(divida => {
      const cnpj = divida.cnpj;

      if (!clientesMap[cnpj]) {
        clientesMap[cnpj] = {
          cnpj,
          empresa: divida.empresa,
          total_dividas: 0,
          dividas: [],
          situacoes: new Set(),
          vencimentos: []
        };
      }

      clientesMap[cnpj].total_dividas += parseFloat(divida.saldo_devedor || 0);
      clientesMap[cnpj].dividas.push({
        codigo: divida.codigo,
        periodo: divida.periodo,
        saldo_devedor: parseFloat(divida.saldo_devedor || 0),
        vencimento: divida.vencimento,
        situacao: divida.situacao
      });
      clientesMap[cnpj].situacoes.add(divida.situacao);
      clientesMap[cnpj].vencimentos.push(divida.vencimento);
    });

    // 6. Retorna array final agrupado
    return Object.values(clientesMap).map(cliente => {
      let situacaoCritica = '';
      if (cliente.situacoes.has('VENCIDA')) {
        situacaoCritica = 'VENCIDA';
      } else if (cliente.situacoes.has('A VENCER')) {
        situacaoCritica = 'A VENCER';
      } else {
        situacaoCritica = Array.from(cliente.situacoes).join(', ');
      }

      const datasVencimento = cliente.vencimentos.map(v => {
        const [dia, mes, ano] = v.split('/');
        return new Date(ano, mes - 1, dia);
      });
      datasVencimento.sort((a, b) => a - b);
      const proximoVencimento = datasVencimento[0]?.toLocaleDateString('pt-BR') || '-';

      return {
        ...cliente,
        total_dividas: cliente.total_dividas.toFixed(2),
        qtd_dividas: cliente.dividas.length,
        situacao_consolidada: situacaoCritica,
        proximo_vencimento: proximoVencimento
      };
    });
  }, [dividas]);

  // Função para alternar a expansão
  const toggleExpand = (cnpj) => {
    setExpandedRows(prev => ({
      ...prev,
      [cnpj]: !prev[cnpj]
    }));
  };

  // Função para reverter o status de email enviado
  const reverterStatusEmail = (cnpj) => {
    const novosEmailsEnviados = { ...emailsEnviados };
    delete novosEmailsEnviados[cnpj];
    
    setEmailsEnviados(novosEmailsEnviados);
    localStorage.setItem('emailsDividasEnviados', JSON.stringify(novosEmailsEnviados));
    toast.info('Status de e-mail revertido');
  };

  // Funções para email
  const handlePrepareEmail = (cliente) => {
    setSelectedClienteEmail(cliente);
    setShowEmailModal(true);
  };

  const handleCloseEmailModal = () => {
    setShowEmailModal(false);
    setSelectedClienteEmail(null);
  };

  const handleSendEmail = async (destinatario, emailCopia, assunto, corpoHtml) => {
    try {
      const token = localStorage.getItem('access');
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE}/api/enviar-email-dividas/`, 
        {
          destinatario: destinatario,
          email_copia: emailCopia,  // Adicionando email em cópia
          assunto: assunto,
          corpo_html: corpoHtml,
          cliente: selectedClienteEmail.empresa,
          cnpj: selectedClienteEmail.cnpj
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        toast.success(`E-mail enviado com sucesso para ${destinatario} (CC: ${emailCopia})`);
        
        // Atualizar registro de emails enviados
        const novosEmailsEnviados = {
          ...emailsEnviados,
          [selectedClienteEmail.cnpj]: {
            enviado: true,
            data: new Date().toISOString(),
            destinatario: destinatario,
            email_copia: emailCopia
          }
        };
        
        // Atualizar estado e localStorage
        setEmailsEnviados(novosEmailsEnviados);
        localStorage.setItem('emailsDividasEnviados', JSON.stringify(novosEmailsEnviados));
        
        handleCloseEmailModal();
      } else {
        toast.error(`Erro ao enviar e-mail: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Erro ao enviar e-mail:', error);
      toast.error(`Erro ao enviar e-mail: ${error.message}`);
    }
  };

  // Função para exportar para CSV
  const exportarCSV = () => {
    const cabecalho = ['CNPJ', 'Empresa', 'Total de Dívidas (R$)', 'Qtd. Dívidas', 'Próximo Vencimento', 'Situação'];
    
    const linhas = clientesAgrupados.map(cliente => [
      cliente.cnpj,
      `"${cliente.empresa.replace(/"/g, '""')}"`,
      cliente.total_dividas.replace('.', ','),
      cliente.qtd_dividas,
      cliente.proximo_vencimento,
      `"${cliente.situacao_consolidada.replace(/"/g, '""')}"`
    ].join(','));
    
    const conteudoCSV = [cabecalho.join(','), ...linhas].join('\n');
    const blob = new Blob([conteudoCSV], { type: 'text/csv;charset=utf-8;' });
    
    // Cria link para download
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_dividas_mes_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!show) return null;

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Clientes com Dívidas no Mês Atual</h5>
              <button type="button" className="btn-close" onClick={handleClose}></button>
              
            </div>
            <div className="modal-body">
              {clientesAgrupados.length === 0 ? (
                <div className="alert alert-info">
                  Não há clientes com dívidas para o mês atual.
                </div>
              ) : (
                <>
                  <div className="alert alert-warning">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    Encontrados {clientesAgrupados.length} clientes com dívidas para o mês atual.
                  </div>
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead>
                        <tr>
                          <th style={{width: "40px"}}></th>
                          <th>CNPJ</th>
                          <th>Empresa</th>
                          <th>Total</th>
                          <th>Qtd. Dívidas</th>
                          <th>Próximo Venc.</th>
                          <th>Situação</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientesAgrupados.map((cliente) => (
                          <React.Fragment key={cliente.cnpj}>
                            <tr className={getSituacaoClass(cliente.situacao_consolidada)}>
                              <td>
                                <button 
                                  className="btn btn-sm btn-link" 
                                  onClick={() => toggleExpand(cliente.cnpj)}
                                >
                                  <i className={`fas fa-${expandedRows[cliente.cnpj] ? 'minus' : 'plus'}-circle`}></i>
                                </button>
                              </td>
                              <td>{cliente.cnpj}</td>
                              <td>{cliente.empresa}</td>
                              <td className="text-end">
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                }).format(cliente.total_dividas)}
                              </td>
                              <td className="text-center">{cliente.qtd_dividas}</td>
                              <td>{cliente.proximo_vencimento}</td>
                              <td>{cliente.situacao_consolidada}</td>
                              <td>
                                <div className="btn-group">
                                  {emailsEnviados[cliente.cnpj] ? (
                                    <>
                                      <button 
                                        className="btn btn-sm btn-success"
                                        title={`E-mail enviado para ${emailsEnviados[cliente.cnpj].destinatario || 'cliente'}`}
                                        disabled
                                      >
                                        <i className="fas fa-check"></i>
                                      </button>
                                      <button 
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => reverterStatusEmail(cliente.cnpj)}
                                        title="Reverter status de e-mail"
                                      >
                                        <i className="fas fa-undo"></i>
                                      </button>
                                    </>
                                  ) : (
                                    <button 
                                      className="btn btn-sm btn-primary"
                                      onClick={() => handlePrepareEmail(cliente)}
                                      title="Enviar e-mail de cobrança"
                                    >
                                      <i className="fas fa-envelope"></i>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            
                            {/* Detalhes expandidos */}
                            {expandedRows[cliente.cnpj] && (
                              <tr>
                                <td colSpan="8" className="p-0">
                                  <div className="p-3 bg-light">
                                    <h6>Detalhes das Dívidas</h6>
                                    <table className="table table-sm">
                                      <thead>
                                        <tr>
                                          <th>Código</th>
                                          <th>Período</th>
                                          <th>Valor</th>
                                          <th>Vencimento</th>
                                          <th>Situação</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {cliente.dividas.map((divida, idx) => (
                                          <tr key={idx} className={getSituacaoClass(divida.situacao)}>
                                            <td>{divida.codigo}</td>
                                            <td>{divida.periodo}</td>
                                            <td className="text-end">
                                              {new Intl.NumberFormat('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL'
                                              }).format(divida.saldo_devedor)}
                                            </td>
                                            <td>{divida.vencimento}</td>
                                            <td>{divida.situacao}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    {emailsEnviados[cliente.cnpj] && (
                                      <div className="alert alert-success mt-3">
                                        <i className="fas fa-check-circle me-2"></i>
                                        <small>
                                          E-mail enviado para {emailsEnviados[cliente.cnpj].destinatario} em {new Date(emailsEnviados[cliente.cnpj].data).toLocaleDateString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                                          {emailsEnviados[cliente.cnpj].email_copia && 
                                            <span> (CC: {emailsEnviados[cliente.cnpj].email_copia})</span>
                                          }
                                        </small>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>Fechar</button>
              {clientesAgrupados.length > 0 && (
                <button type="button" className="btn btn-primary" onClick={exportarCSV}>
                  <i className="fas fa-download me-2"></i>
                  Exportar CSV
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="modal-backdrop show" onClick={handleClose}></div>
      </div>
      
      {/* Modal para visualizar e enviar e-mail */}
      {showEmailModal && (
        <EmailPreviewModal 
          show={showEmailModal}
          handleClose={handleCloseEmailModal}
          emailData={selectedClienteEmail}
          handleSendEmail={handleSendEmail}
        />
      )}
    </>
  );
};

const Dividas = () => {
  const [dividas, setDividas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [processamentoInfo, setProcessamentoInfo] = useState(null);

  // Estados para filtros
  const [filters, setFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [showModalDividasMes, setShowModalDividasMes] = useState(false);

  // Mapeamento para nomes mais amigáveis das colunas
  const columnNames = {
    'cnpj': 'CNPJ',
    'empresa': 'Empresa',
    'codigo': 'Código',
    'periodo': 'Período',
    'vencimento': 'Vencimento',
    'valor_original': 'Valor Original',
    'saldo_devedor': 'Saldo Devedor',
    'situacao': 'Situação',
    'data_emissao': 'Data de Emissão',
    'data_validade': 'Data de Validade',
    'total_dividas': 'Total de Dívidas',
    'data_registro': 'Data de Registro'
  };

  const columnsToShow = [
    'cnpj', 
    'empresa', 
    'codigo', 
    'periodo', 
    'vencimento', 
    'valor_original', 
    'saldo_devedor', 
    'situacao', 
    'data_emissao', 
    'data_validade', 
    'total_dividas', 
    'data_registro'
  ];

  // Função para atualizar dados (processar PDFs)
  const atualizarDados = async () => {
    try {
      setAtualizando(true);
      setProcessamentoInfo(null);
      
      // Obter token de autenticação
      const token = localStorage.getItem('access');
      
      // Chamar endpoint para processar PDFs
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE}/api/processar-pdfs/`, 
        {},  // corpo vazio
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Verificar resposta
      if (response.data.success) {
        // Armazenar informações do processamento
        setProcessamentoInfo({
          total: response.data.total_processados,
          semDivida: response.data.pdfs_sem_divida,
          comDivida: response.data.pdfs_com_divida,
          comErro: response.data.pdfs_com_erro
        });
        
        // Mostrar toast de sucesso
        toast.success(`Processamento concluído com sucesso!`);

        // Atualizar lista de dívidas
        const dividasResponse = await axios.get(
          `${process.env.REACT_APP_API_BASE}/api/dividas/`, 
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (dividasResponse.data.success) {
          setDividas(dividasResponse.data.dividas);
        }
      } else {
        // Mostrar erro
        toast.error('Erro no processamento: ' + response.data.error);
      }
    } catch (error) {
      console.error('Erro na atualização:', error);
      toast.error('Erro ao atualizar dados: ' + (error.response?.data?.error || error.message));
    } finally {
      setAtualizando(false);
    }
  };

  // Buscar dados
  useEffect(() => {
    const fetchDividas = async () => {
      try {
        const token = localStorage.getItem('access');
        const response = await axios.get(`${process.env.REACT_APP_API_BASE}/api/dividas/`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.data.success) {
          setDividas(response.data.dividas);
          setLoading(false);
        }
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchDividas();
  }, []);

  // Fechar o dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeFilterColumn && !e.target.closest('.filter-dropdown')) {
        setActiveFilterColumn(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeFilterColumn]);

  // Formatação de moeda
  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Filtrar dados
  const filteredDividas = useMemo(() => {
    let result = dividas;

    // Filtro de busca global
    if (searchTerm) {
      result = result.filter(divida => 
        Object.values(divida).some(val => 
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Filtros específicos por coluna
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        result = result.filter(divida => 
          String(divida[key]).toLowerCase().includes(filters[key].toLowerCase())
        );
      }
    });

    return result;
  }, [dividas, filters, searchTerm]);

  // Toggle filter dropdown
  const toggleFilterDropdown = (column, e) => {
    e.stopPropagation();
    setActiveFilterColumn(activeFilterColumn === column ? null : column);
  };

  // Renderização de filtros
  const renderColumnFilter = (column) => {
    return (
      <div className={`filter-dropdown-menu ${activeFilterColumn === column ? 'show' : ''}`}>
        <div className="p-2">
          <input
            type="text"
            className="form-control form-control-sm mb-2"
            placeholder="Filtrar..."
            value={filters[column] || ''}
            onChange={(e) => setFilters(prev => ({
              ...prev,
              [column]: e.target.value
            }))}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="filter-options">
            <button 
              className="btn btn-sm btn-outline-primary w-100 mb-2"
              onClick={(e) => {
                e.stopPropagation();
                setFilters(prev => {
                  const newFilters = {...prev};
                  delete newFilters[column];
                  return newFilters;
                });
              }}
            >
              Limpar Filtro
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="d-flex justify-content-center my-5">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Carregando...</span>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="alert alert-danger my-4" role="alert">
      <h4 className="alert-heading">Erro!</h4>
      <p>{error}</p>
    </div>
  );

  return (
    <div className="container-fluid mt-4">
      <ToastContainer position="top-right" autoClose={5000} />

      <div className="header-wrapper position-relative">
        <i className="fas fa-file-invoice-dollar header-icon"></i>
        <h3 className="titulo-pagina">Pendências Fiscais</h3>
      </div>

      {/* Botões de ação */}
      <div className="row mb-3">
        <div className="col-md-12 d-flex gap-3">
          {/* Botão para atualizar dados */}
          <button 
            className="btn btn-success mb-3" 
            onClick={atualizarDados}
            disabled={atualizando}
          >
            {atualizando ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Processando PDFs...
              </>
            ) : (
              <>
                <i className="fas fa-sync me-2"></i>
                Atualizar Dados
              </>
            )}
          </button>

          {/* Botão para mostrar dívidas do mês atual */}
          <button 
            className="btn btn-warning mb-3"
            onClick={() => setShowModalDividasMes(true)}
          >
            <i className="fas fa-calendar-day me-2"></i>
            Clientes com Dívidas neste Mês
          </button>
        </div>
      </div>

      {/* Informações do último processamento */}
      {processamentoInfo && (
        <div className="alert alert-info">
          <i className="fas fa-info-circle me-2"></i>
          <strong>Resultado do processamento:</strong> 
          <span className="ms-2">Total de PDFs processados: {processamentoInfo.total}</span>
          <span className="ms-2">|</span>
          <span className="ms-2">Sem dívidas: {processamentoInfo.semDivida}</span>
          <span className="ms-2">|</span>
          <span className="ms-2">Com dívidas: {processamentoInfo.comDivida}</span>
          <span className="ms-2">|</span>
          <span className="ms-2">Com erro: {processamentoInfo.comErro}</span>
        </div>
      )}

      {/* Barra de Pesquisa Global */}
      <div className="row mb-3">
        <div className="col-md-6">
          <div className="input-group">
            <span className="input-group-text"><i className="fas fa-search"></i></span>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Busca global..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                className="btn btn-outline-secondary" 
                type="button"
                onClick={() => setSearchTerm('')}
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        </div>
        
        {/* Indicadores de filtros ativos */}
        <div className="col-md-6">
          <div className="d-flex justify-content-end align-items-center">
            {Object.keys(filters).length > 0 && (
              <div className="active-filters">
                <small className="text-muted me-2">Filtros ativos:</small>
                {Object.keys(filters).map(key => (
                  <span key={key} className="badge bg-info text-dark me-1">
                    {columnNames[key]}: {filters[key]}
                    <button 
                      className="btn-close btn-close-white ms-1" 
                      style={{ fontSize: '0.5rem' }}
                      onClick={() => setFilters(prev => {
                        const newFilters = {...prev};
                        delete newFilters[key];
                        return newFilters;
                      })}
                    ></button>
                  </span>
                ))}
                <button 
                  className="btn btn-sm btn-outline-secondary ms-2"
                  onClick={() => setFilters({})}
                >
                  Limpar todos
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card shadow">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover table-striped">
              <thead>
                <tr>
                  {columnsToShow.map((column) => (
                    <th key={column} className="text-center column-header">
                      <div className="d-flex align-items-center justify-content-center column-title">
                        <span>{columnNames[column] || column}</span>
                        <button 
                          className="filter-icon-btn ms-1" 
                          onClick={(e) => toggleFilterDropdown(column, e)}
                          title={`Filtrar por ${columnNames[column] || column}`}
                        >
                          <i className={`fas fa-filter ${filters[column] ? 'text-primary' : 'text-muted'}`}></i>
                        </button>
                        {renderColumnFilter(column)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDividas.length === 0 ? (
                  <tr>
                    <td colSpan={columnsToShow.length} className="text-center">
                      Nenhuma dívida encontrada
                    </td>
                  </tr>
                ) : (
                  filteredDividas.map((divida, index) => (
                    <tr key={index}>
                      {columnsToShow.map((key) => (
                        <td 
                          key={key} 
                          className={`
                            text-center 
                            ${key === 'situacao' ? getSituacaoClass(divida.situacao) : ''} 
                            ${isCurrencyColumn(key) ? 'text-end' : ''}
                          `}
                        >
                          {isCurrencyColumn(key) ? 
                            formatCurrency(divida[key]) : 
                            (divida[key] || '-')}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-footer">
          <div className="d-flex justify-content-between">
            <small className="text-muted">Total de registros: {filteredDividas.length}</small>
            <small className="text-muted">
              Última atualização: {dividas.length > 0 ? dividas[0].data_consulta : '-'}
            </small>
          </div>
        </div>
      </div>

      {/* Modal de clientes com dívidas neste mês */}
      <ClientesComDividaMes 
        show={showModalDividasMes} 
        handleClose={() => setShowModalDividasMes(false)} 
        dividas={dividas} 
      />
    </div>
  );
};

// Funções de classificação
const getSituacaoClass = (situacao) => {
  if (!situacao) return '';
  
  const situacaoLowerCase = situacao.toLowerCase();
  
  if (situacaoLowerCase.includes('sem divida') || situacaoLowerCase.includes('confirmado')) {
    return 'table-success';
  } else if (situacaoLowerCase.includes('a vencer') || situacaoLowerCase.includes('analisar')) {
    return 'table-warning';
  } else if (situacaoLowerCase.includes('devedor')) {
    return 'table-danger';
  }
  
  return '';
};

const isCurrencyColumn = (columnName) => {
  return ['valor_original', 'saldo_devedor', 'total_dividas'].includes(columnName);
};

export default Dividas;