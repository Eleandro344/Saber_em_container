import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/dctfweb.css';

const Dctfweb = () => {
  const hoje = new Date();
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
  const anoAtual = hoje.getFullYear();
  const [competencia, setCompetencia] = useState(`${mesAtual}/${anoAtual}`);

  // Função para formatar CNPJ para exibição
  const formatarCNPJ = (cnpj) => {
    if (!cnpj) return '';
    
    // Limpar qualquer formatação existente
    const limpo = cnpj.replace(/\D/g, '');
    
    // Aplicar formatação
    if (limpo.length === 14) {
      return `${limpo.slice(0,2)}.${limpo.slice(2,5)}.${limpo.slice(5,8)}/${limpo.slice(8,12)}-${limpo.slice(12)}`;
    }
    
    return limpo; // Retornar sem formatação se não tiver 14 dígitos
  };

  const [empresas, setEmpresas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [executando, setExecutando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);
  
  // Estado para o modal de cadastro de empresa
  const [showModal, setShowModal] = useState(false);
  const [novaEmpresa, setNovaEmpresa] = useState({
    cod: '',
    razaosocial: '',
    operador: '',
    cnpj: ''
  });
  const [cadastrando, setCadastrando] = useState(false);

  const [filtros, setFiltros] = useState({
    cod: '',
    razaosocial: '',
    operador: '',
    cnpj: '',
    situacao: '',
    pagamento: '',
    data_vencimento: '',
    valor: '',
    postado: '',
    data_geracao: '',
  });

  const carregarEmpresas = useCallback(() => {
    console.log('Carregando empresas para competência:', competencia);
    axios
      .get(`${process.env.REACT_APP_API_BASE}/api/empresas-dctfweb/?competencia=${competencia}`)
      .then((res) => {
        console.log('Empresas carregadas:', res.data.length);
        setEmpresas(res.data);
      })
      .catch((error) => {
        console.error('Erro ao carregar empresas:', error);
        setMensagem('Erro ao carregar empresas.');
      });
  }, [competencia]);

  useEffect(() => {
    if (!competencia) return;
    carregarEmpresas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia]);

  // Efeito para definir o estilo do body quando o modal estiver aberto
  useEffect(() => {
    if (showModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    // Cleanup function
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showModal]);

  const handleCheckbox = (cnpj) => {
    setSelecionadas((prev) =>
      prev.includes(cnpj) ? prev.filter((item) => item !== cnpj) : [...prev, cnpj]
    );
  };

  // Função para alternar o status "postado"
  const alternarStatusPostado = async (cnpj, statusAtual) => {
    const novoStatus = statusAtual === 'Sim' ? 'Não' : 'Sim';
    
    setAtualizandoStatus(true);
    setMensagem('Atualizando status...');
    
    try {
      console.log('Enviando requisição para atualizar status:', cnpj, novoStatus);
      await axios.post(
        `${process.env.REACT_APP_API_BASE}/api/atualizar-status-postado/`,
        { 
          cnpj: cnpj, 
          postado: novoStatus === 'Sim'
        }
      );
      
      setEmpresas(empresas.map(emp => {
        if (emp.cnpj === cnpj) {
          return { ...emp, postado: novoStatus };
        }
        return emp;
      }));
      
      setMensagem(`Status atualizado com sucesso para "${novoStatus}"`);
      
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setMensagem(`Erro ao atualizar status: ${error.response?.data?.mensagem || error.message}`);
    } finally {
      setAtualizandoStatus(false);
    }
  };

  // Funções para o modal de cadastro
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovaEmpresa(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const limparFormulario = () => {
    setNovaEmpresa({
      cod: '',
      razaosocial: '',
      operador: '',
      cnpj: ''
    });
  };

  const cadastrarEmpresa = async () => {
    console.log('Cadastrando nova empresa:', novaEmpresa);
    
    // Validação básica
    if (!novaEmpresa.cod || !novaEmpresa.razaosocial || !novaEmpresa.cnpj) {
      setMensagem('Preencha todos os campos obrigatórios: Código, Razão Social e CNPJ');
      return;
    }

    // Limpar o CNPJ para conter apenas números
    const cnpjLimpo = novaEmpresa.cnpj.replace(/\D/g, '');
    
    // Verificar se o CNPJ tem exatamente 14 dígitos
    if (cnpjLimpo.length !== 14) {
      setMensagem('CNPJ deve conter exatamente 14 dígitos');
      return;
    }

    setCadastrando(true);
    setMensagem('Cadastrando empresa...');

    try {
      // Criar objeto com CNPJ apenas com números
      const empresaParaEnviar = {
        ...novaEmpresa,
        cnpj: cnpjLimpo // Enviar apenas os números do CNPJ
      };
      
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE}/api/cadastrar-empresa/`,
        empresaParaEnviar
      );
      
      console.log('Resposta do servidor:', response.data);
      setMensagem('Empresa cadastrada com sucesso!');
      setShowModal(false);
      limparFormulario();
      
      // Recarregar a lista de empresas
      carregarEmpresas();
    } catch (error) {
      console.error('Erro ao cadastrar empresa:', error);
      setMensagem(`Erro ao cadastrar empresa: ${error.response?.data?.mensagem || error.message}`);
    } finally {
      setCadastrando(false);
    }
  };

  const baixarZip = (endpoint, nomeArquivo, sucessoMsg, erroMsg) => async () => {
    if (selecionadas.length === 0) {
      setMensagem('Selecione ao menos uma empresa');
      return;
    }

    setExecutando(true);
    setMensagem('');

    try {
      const res = await axios.post(
        endpoint,
        { cnpjs: selecionadas, competencia },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', nomeArquivo);
      document.body.appendChild(link);
      link.click();
      setMensagem(sucessoMsg);
    } catch (error) {
      if (error.response?.status === 500) {
        setMensagem('⚠️ A DARF do mês solicitado ainda não está disponível.');
      } else {
        setMensagem(erroMsg + (error.response?.data?.mensagem || error.message));
      }
    }

    setExecutando(false);
  };

  const executar = baixarZip(
    `${process.env.REACT_APP_API_BASE}/api/dctfweb/`,
    'relatorios_dctfweb.zip',
    'Download de DARFs iniciado com sucesso.',
    'Erro ao gerar DARFs: '
  );

  const gerarRecibos = baixarZip(
    `${process.env.REACT_APP_API_BASE}/api/dctfweb/recibos/`,
    'recibos_dctfweb.zip',
    'Recibos baixados com sucesso.',
    'Erro ao gerar recibos: '
  );

  const gerarDeclaracoes = baixarZip(
    `${process.env.REACT_APP_API_BASE}/api/dctfweb/declaracoes/`,
    'declarações_dctfweb.zip',
    'Declarações baixadas com sucesso.',
    'Erro ao gerar declarações: '
  );

  const gerarXmls = baixarZip(
    `${process.env.REACT_APP_API_BASE}/api/dctfweb/xmls/`,
    'xmls_dctfweb.zip',
    'XMLs normais baixados com sucesso.',
    'Erro ao gerar XMLs: '
  );

  const gerarXmlsAssinados = baixarZip(
    `${process.env.REACT_APP_API_BASE}/api/dctfweb/xmls-assinados/`,
    'xmls_assinados_dctfweb.zip',
    'XMLs assinados baixados com sucesso.',
    'Erro ao gerar XMLs assinados: '
  );

  const consultarGuiasAndamento = baixarZip(
    `${process.env.REACT_APP_API_BASE}/api/dctfweb/guias-em-andamento/`,
    'guias_em_andamento.zip',
    'Guias em andamento baixadas com sucesso.',
    'Erro ao consultar guias: '
  );

  return (
    <div className="dctfweb-page">
      <div className="container mt-5 shadow p-4 rounded bg-white">
        <div className="header-wrapper d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center">
            <i className="fas fa-file-alt header-icon me-2"></i>
            <h2 className="titulo-pagina m-0">Relatórios DCTFWeb</h2>
          </div>
          <button 
            className="btn btn-success" 
            onClick={() => {
              console.log('Botão Nova Empresa clicado');
              setShowModal(true);
            }}
          >
            <i className="fas fa-plus me-1"></i> Nova Empresa
          </button>
        </div>

        {mensagem && (
          <div className={`alert ${mensagem.includes('⚠️') || mensagem.includes('Erro') ? 'alert-danger' : 'alert-info'}`}>
            {mensagem}
          </div>
        )}

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

        <div className="d-flex flex-wrap justify-content-end gap-2 mb-2">
          <button className="btn btn-primary px-4" onClick={executar} disabled={executando}>
            {executando ? '⏳ Gerando...' : '📑 Gerar DARF'}
          </button>

          <button className="btn btn-primary px-4" onClick={gerarRecibos} disabled={executando}>
            {executando ? '⏳ Aguarde...' : '📄 Gerar Recibo'}
          </button>

          <button className="btn btn-primary px-4" onClick={gerarDeclaracoes} disabled={executando}>
            {executando ? '⏳ Processando...' : '📑 Baixar Declaração'}
          </button>

          <button className="btn btn-primary px-4" onClick={gerarXmls} disabled={executando}>
            {executando ? '⏳ Baixando...' : '📄 Baixar XML'}
          </button>

          <button className="btn btn-primary px-4" onClick={gerarXmlsAssinados} disabled={executando}>
            {executando ? '⏳ Assinando...' : '📄 Assinar XML'}
          </button>

          <button className="btn btn-primary px-4" onClick={consultarGuiasAndamento} disabled={executando}>
            {executando ? '⏳ Consultando...' : '2° Via de DARF'}
          </button>
        </div>

        <div className="table-responsive">
          <table className="table table-bordered table-hover text-center align-middle fs-6">
            <thead className="table-light">
              <tr>
                <th></th>
                <th>Código</th>
                <th>Razão Social</th>
                <th>Operador</th>
                <th>CNPJ</th>
                <th>Situação</th>
                <th>Pagamento</th>
                <th>Data vencimento</th>
                <th>Valor</th>
                <th>Postado Onvio</th>
                <th>Data Geração</th>
              </tr>
              <tr>
                <th></th>
                <th>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Filtrar..."
                    onChange={(e) => setFiltros(prev => ({ ...prev, cod: e.target.value }))}
                  />
                </th>
                <th>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Filtrar..."
                    onChange={(e) => setFiltros(prev => ({ ...prev, razaosocial: e.target.value }))}
                  />
                </th>
                <th>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Filtrar..."
                    onChange={(e) => setFiltros(prev => ({ ...prev, operador: e.target.value }))}
                  />
                </th>
                <th>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Filtrar..."
                    onChange={(e) => setFiltros(prev => ({ ...prev, cnpj: e.target.value }))}
                  />
                </th>
                <th>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Filtrar..."
                    onChange={(e) => setFiltros(prev => ({ ...prev, situacao: e.target.value }))}
                  />
                </th>
                <th>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Filtrar..."
                    onChange={(e) => setFiltros(prev => ({ ...prev, pagamento: e.target.value }))}
                  />
                </th>
                <th>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Filtrar..."
                    onChange={(e) => setFiltros(prev => ({ ...prev, data_vencimento: e.target.value }))}
                  />
                </th>
                <th>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Filtrar..."
                    onChange={(e) => setFiltros(prev => ({ ...prev, valor: e.target.value }))}
                  />
                </th>
                <th>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Filtrar..."
                    onChange={(e) => setFiltros(prev => ({ ...prev, postado: e.target.value }))}
                  />
                </th>
                <th>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Filtrar..."
                    onChange={(e) => setFiltros(prev => ({ ...prev, data_geracao: e.target.value }))}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {empresas
                .filter(emp =>
                  Object.entries(filtros).every(([campo, valor]) =>
                    emp[campo]?.toString().toLowerCase().includes(valor.toLowerCase())
                  )
                )
                .map((empresa) => (
                  <tr key={empresa.cnpj}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selecionadas.includes(empresa.cnpj)}
                        onChange={() => handleCheckbox(empresa.cnpj)}
                      />
                    </td>
                    <td>{empresa.cod}</td>
                    <td className="text-start">{empresa.razaosocial}</td>
                    <td>{empresa.operador}</td>
                    <td>{formatarCNPJ(empresa.cnpj)}</td>
                    <td>
                      <span className={`badge ${empresa.situacao === 'Não gerado' ? 'bg-danger' : 'bg-success'}`}>
                        {empresa.situacao}
                      </span>
                    </td>
                    <td>
                      <span className={
                        empresa.pagamento === 'LANÇADO'
                          ? 'text-success fw-bold'
                          : empresa.pagamento
                            ? 'text-danger fw-bold'
                            : 'text-muted'
                      }>
                        {empresa.pagamento || '-'}
                      </span>
                    </td>
                    <td>{empresa.data_vencimento || '-'}</td>
                    <td>{empresa.valor}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${empresa.postado === 'Sim' ? 'btn-success' : 'btn-outline-secondary'}`}
                        onClick={() => alternarStatusPostado(empresa.cnpj, empresa.postado)}
                        disabled={atualizandoStatus}
                      >
                        {empresa.postado || 'Não'}
                      </button>
                    </td>
                    <td>{empresa.data_geracao || '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Modal customizado sem React Bootstrap */}
        {showModal && (
          <div className="modal-custom">
            <div className="modal-overlay" onClick={() => setShowModal(false)}></div>
            <div className="modal-container">
              <div className="modal-header">
                <h5 className="modal-title">Cadastrar Nova Empresa</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  cadastrarEmpresa();
                }}>
                  <div className="mb-3">
                    <label htmlFor="cod" className="form-label">Código *</label>
                    <input
                      type="text"
                      className="form-control"
                      id="cod"
                      name="cod"
                      value={novaEmpresa.cod}
                      onChange={handleInputChange}
                      placeholder="Ex: 123"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="razaosocial" className="form-label">Razão Social *</label>
                    <input
                      type="text"
                      className="form-control"
                      id="razaosocial"
                      name="razaosocial"
                      value={novaEmpresa.razaosocial}
                      onChange={handleInputChange}
                      placeholder="Nome da empresa"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="operador" className="form-label">Operador</label>
                    <input
                      type="text"
                      className="form-control"
                      id="operador"
                      name="operador"
                      value={novaEmpresa.operador}
                      onChange={handleInputChange}
                      placeholder="Nome do operador"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="cnpj" className="form-label">CNPJ *</label>
                    <input
                      type="text"
                      className="form-control"
                      id="cnpj"
                      name="cnpj"
                      value={novaEmpresa.cnpj}
                      onChange={(e) => {
                        // Permitir apenas números
                        const apenasNumeros = e.target.value.replace(/\D/g, '');
                        setNovaEmpresa(prev => ({
                          ...prev,
                          cnpj: apenasNumeros
                        }));
                      }}
                      placeholder="Digite apenas números"
                      maxLength={14}
                      required
                    />
                    <small className="text-muted d-block mt-1">
                      Digite apenas os 14 números do CNPJ
                    </small>
                  </div>
                  
                  {/* Botão de envio oculto para permitir submissão pelo Enter */}
                  <input type="submit" hidden />
                </form>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={cadastrarEmpresa}
                  disabled={cadastrando}
                >
                  {cadastrando ? 'Cadastrando...' : 'Cadastrar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dctfweb;