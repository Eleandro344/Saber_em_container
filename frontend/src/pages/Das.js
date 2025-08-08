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
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(true); // Novo estado para carregamento

  const carregarEmpresas = useCallback(() => {
    setCarregando(true);
    console.log('Carregando empresas para URL:', `${process.env.REACT_APP_API_BASE}/api/empresas-das/`);
    axios
      .get(`${process.env.REACT_APP_API_BASE}/api/empresas-das/`)
      .then((res) => {
        console.log('Resposta completa:', res);
        console.log('Dados recebidos:', res.data);
        console.log('Número de empresas:', res.data.length);

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
        console.error('Detalhes do erro:', 
          error.response ? error.response.data : 'Sem resposta do servidor'
        );
        setMensagem(`Erro ao carregar empresas: ${error.message}`);
        setCarregando(false);
      });
  }, []);

  useEffect(() => {
    carregarEmpresas();
  }, [carregarEmpresas]);

  return (
    <div className="container mt-5 shadow p-4 rounded bg-white">
      <div className="header-wrapper">
        <i className="fas fa-file-alt header-icon"></i>
        <h2 className="titulo-pagina">Relatórios DAS</h2>
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

      <div className="table-responsive">
        {carregando ? ( // Mensagem de carregamento
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
                <th>Razão Social</th>
                <th>CNPJ</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((empresa) => (
                <tr key={empresa.cnpj}>
                  <td className="text-start">{empresa.razaosocial}</td>
                  <td>{formatarCNPJ(empresa.cnpj)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Das;