import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/dctfweb.css';

const Dctfweb = () => {
  const hoje = new Date();
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
  const anoAtual = hoje.getFullYear();
  const [competencia, setCompetencia] = useState(`${mesAtual}/${anoAtual}`);

  const [empresas, setEmpresas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [executando, setExecutando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);

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

  const carregarEmpresas = () => {
    axios
      .get(`${process.env.REACT_APP_API_BASE}/api/empresas-dctfweb/?competencia=${competencia}`)
      .then((res) => setEmpresas(res.data))
      .catch(() => setMensagem('Erro ao carregar empresas.'));
  };

  useEffect(() => {
    if (!competencia) return;
    carregarEmpresas();
  }, [competencia]);

  const handleCheckbox = (cnpj) => {
    setSelecionadas((prev) =>
      prev.includes(cnpj) ? prev.filter((item) => item !== cnpj) : [...prev, cnpj]
    );
  };

  // Função para alternar o status "postado"
  const alternarStatusPostado = async (cnpj, statusAtual) => {
    // Definir o novo status (alternando entre "Sim" e "Não" ou adicionando "Sim" se for nulo)
    const novoStatus = statusAtual === 'Sim' ? 'Não' : 'Sim';
    
    setAtualizandoStatus(true);
    setMensagem('Atualizando status...');
    
    try {
      // Chamar API para atualizar o status
      await axios.post(
        `${process.env.REACT_APP_API_BASE}/api/atualizar-status-postado/`,
        { 
          cnpj: cnpj, 
          postado: novoStatus === 'Sim'  // Enviar true para "Sim" e false para "Não"
        }
      );
      
      // Atualizar a lista local para refletir a mudança sem precisar recarregar
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
    <div className="container mt-5 shadow p-4 rounded bg-white">
      <div className="header-wrapper">
        <i className="fas fa-file-alt header-icon"></i>
        <h2 className="titulo-pagina">Relatórios DCTFWeb</h2>
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
                  <td>{empresa.cnpj}</td>
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
    </div>
  );
};

export default Dctfweb;