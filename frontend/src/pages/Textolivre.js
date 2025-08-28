import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Contabilidade.css';

const TextoLivre = () => {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState([]);
  const [textosLivres, setTextosLivres] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  
  // Estados do formulário
  const [empresaSelecionada, setEmpresaSelecionada] = useState('');
  const [textoDigitado, setTextoDigitado] = useState('');
  const [filtroTextos, setFiltroTextos] = useState('');

  // Carregar empresas
  const carregarEmpresas = () => {
    const accessToken = localStorage.getItem('access');
    
    axios
      .get(`${process.env.REACT_APP_API_BASE}/api/empresas-contabil/`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .then((res) => {
        const empresasCarregadas = res.data.empresas || [];
        setEmpresas(empresasCarregadas.sort((a, b) => a.empresa.localeCompare(b.empresa)));
      })
      .catch((error) => {
        setMensagem('Erro ao carregar empresas: ' + (error.response?.data?.erro || error.message));
      });
  };

  // Carregar textos livres
  const carregarTextosLivres = () => {
    setCarregando(true);
    const accessToken = localStorage.getItem('access');
    
    axios
      .get(`${process.env.REACT_APP_API_BASE}/api/textos-livres-contabil/`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .then((res) => {
        setTextosLivres(res.data.textos || []);
        setCarregando(false);
      })
      .catch((error) => {
        setMensagem('Erro ao carregar textos: ' + (error.response?.data?.erro || error.message));
        setCarregando(false);
      });
  };

  // Salvar novo texto
  const salvarTexto = () => {
    if (!empresaSelecionada || !textoDigitado.trim()) {
      setMensagem('Por favor, selecione uma empresa e digite o texto.');
      return;
    }

    setSalvando(true);
    const accessToken = localStorage.getItem('access');
    
    const empresaInfo = empresas.find(emp => emp.numero_dominio.toString() === empresaSelecionada);
    
    axios
      .post(
        `${process.env.REACT_APP_API_BASE}/api/salvar-texto-livre-contabil/`,
        {
          numero_dominio: empresaSelecionada,
          empresa: empresaInfo?.empresa || '',
          texto: textoDigitado.trim()
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      )
      .then(() => {
        setMensagem('Texto salvo com sucesso!');
        setTextoDigitado('');
        setEmpresaSelecionada('');
        carregarTextosLivres();
        setSalvando(false);
      })
      .catch((error) => {
        setMensagem('Erro ao salvar texto: ' + (error.response?.data?.erro || error.message));
        setSalvando(false);
      });
  };

  // Filtrar textos
  const textosFiltrados = textosLivres.filter((item) => {
    if (!filtroTextos) return true;
    
    const filtroLower = filtroTextos.toLowerCase();
    return (
      item.empresa.toLowerCase().includes(filtroLower) ||
      item.numero_dominio.toString().includes(filtroLower) ||
      item.texto.toLowerCase().includes(filtroLower)
    );
  });

  useEffect(() => {
    carregarEmpresas();
    carregarTextosLivres();
  }, []);

  return (
    <div className="contabilidade-page">
      <div className="container mt-5 shadow p-4 rounded bg-white">
        {/* Cabeçalho */}
        <div className="header-wrapper d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center">
            <i className="fas fa-edit header-icon me-2"></i>
            <h2 className="titulo-pagina m-0">Textos Livres - Contábil</h2>
          </div>
          <button 
            className="btn btn-outline-secondary"
            onClick={() => navigate('/contabilidade')}
          >
            <i className="fas fa-arrow-left me-2"></i>
            Voltar
          </button>
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

        {/* Formulário para criar novo texto */}
        <div className="card mb-4">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">
              <i className="fas fa-plus-circle me-2"></i>
              Adicionar Novo Texto
            </h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label fw-bold">Empresa:</label>
                <select
                  className="form-select"
                  value={empresaSelecionada}
                  onChange={(e) => setEmpresaSelecionada(e.target.value)}
                  disabled={salvando}
                >
                  <option value="">Selecione uma empresa...</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.numero_dominio} value={empresa.numero_dominio}>
                      {empresa.numero_dominio} - {empresa.empresa}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-8 mb-3">
                <label className="form-label fw-bold">Texto:</label>
                <textarea
                  className="form-control"
                  rows="4"
                  placeholder="Digite aqui suas observações sobre a empresa..."
                  value={textoDigitado}
                  onChange={(e) => setTextoDigitado(e.target.value)}
                  disabled={salvando}
                  maxLength="1000"
                />
                <small className="text-muted">
                  {textoDigitado.length}/1000 caracteres
                </small>
              </div>
            </div>
            <div className="text-end">
              <button
                className="btn btn-primary"
                onClick={salvarTexto}
                disabled={!empresaSelecionada || !textoDigitado.trim() || salvando}
              >
                {salvando ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Salvando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save me-2"></i>
                    Salvar Texto
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Lista de textos existentes */}
        <div className="card">
          <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <i className="fas fa-list me-2"></i>
              Textos Cadastrados
            </h5>
            <span className="badge bg-light text-dark">
              {textosFiltrados.length} registro(s)
            </span>
          </div>
          <div className="card-body">
            {/* Campo de filtro */}
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Filtrar por empresa, domínio ou texto..."
                value={filtroTextos}
                onChange={(e) => setFiltroTextos(e.target.value)}
              />
            </div>

            {carregando ? (
              <div className="text-center py-4">
                <div className="spinner-border" role="status"></div>
                <p className="mt-2">Carregando textos...</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead className="table-dark">
                    <tr>
                      <th style={{ width: '150px' }}>Data/Hora</th>
                      <th style={{ width: '120px' }}>Nº Domínio</th>
                      <th style={{ width: '250px' }}>Empresa</th>
                      <th>Texto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {textosFiltrados.length > 0 ? (
                      textosFiltrados.map((item, index) => (
                        <tr key={index}>
                          <td className="text-nowrap">{item.data_hoje}</td>
                          <td className="text-center">{item.numero_dominio}</td>
                          <td className="fw-semibold">{item.empresa}</td>
                          <td>
                            <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                              {item.texto}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="text-center text-muted py-4">
                          {filtroTextos ? 'Nenhum texto encontrado com esse filtro.' : 'Nenhum texto cadastrado ainda.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextoLivre;