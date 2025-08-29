import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import '../styles/CadastrarCliente.css';

const CadastrarCliente = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [operadoresUnicos, setOperadoresUnicos] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // Estado para os dados do formulário
  const [formData, setFormData] = useState({
    empresa: '',
    drive_cliente: '',
    dt: '',
    regime: '',
    operador: '',
    competencia_entrada: '',
    competencia_saida: '',
    tipo_empresa: '',
    tipo_entrega: '',
    controle_financeiro: '',
    link_bi: '',
    senha_bi: '',
    tipo_bi: '',
    prioridade_cs: '',
    numero_dominio: '', // Campo obrigatório
    bi_conferido: '',
    ultima_entrega: '',
    proxima_entrega: ''
  });

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

  // Carregar operadores únicos
  useEffect(() => {
    const carregarOperadores = async () => {
      try {
        const accessToken = localStorage.getItem('access');
        const response = await axios.get(`${process.env.REACT_APP_API_BASE}/api/empresas-contabil/`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        const empresas = response.data.empresas || [];
        const operadores = [...new Set(empresas.map(emp => emp.operador).filter(Boolean))].sort();
        setOperadoresUnicos(operadores);
      } catch (error) {
        console.error('Erro ao carregar operadores:', error);
      }
    };

    carregarOperadores();
  }, []);

  // Função para atualizar os campos do formulário
  const handleInputChange = (campo, valor) => {
    setFormData(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  // Função para validar o formulário
  const validarFormulario = () => {
    if (!formData.numero_dominio.trim()) {
      setMessage('O campo "Número Domínio" é obrigatório.');
      return false;
    }
    return true;
  };

  // Função para submeter o formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validarFormulario()) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const accessToken = localStorage.getItem('access');
      
      // Preparar dados para envio (remover campos vazios)
      const dadosLimpos = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value && value.toString().trim() !== '') {
          dadosLimpos[key] = value.toString().trim();
        }
      });

      await axios.post(
        `${process.env.REACT_APP_API_BASE}/api/cadastrar-cliente/`,
        dadosLimpos,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      setMessage('Cliente cadastrado com sucesso!');
      
      // Limpar formulário após sucesso
      setFormData({
        empresa: '',
        drive_cliente: '',
        dt: '',
        regime: '',
        operador: '',
        competencia_entrada: '',
        competencia_saida: '',
        tipo_empresa: '',
        tipo_entrega: '',
        controle_financeiro: '',
        link_bi: '',
        senha_bi: '',
        tipo_bi: '',
        prioridade_cs: '',
        numero_dominio: '',
        bi_conferido: '',
        ultima_entrega: '',
        proxima_entrega: ''
      });

      setCurrentStep(1); // Voltar para o primeiro step

    } catch (error) {
      const errorMsg = 
        error.response?.data?.erro ||
        error.response?.data?.mensagem ||
        error.message ||
        'Erro desconhecido ao cadastrar cliente';
      setMessage(`Erro: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Função para navegar entre steps
  const nextStep = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Validação do step atual
  const canProceedToNext = () => {
    if (currentStep === 1) {
      return formData.numero_dominio.trim() !== '';
    }
    return true;
  };

  // Renderizar campos por step
  const renderStep1 = () => (
    <div className="cadastrar-cliente-step-content">
      <div className="cadastrar-cliente-step-header">
        <div className="cadastrar-cliente-step-icon">
          <i className="fas fa-building"></i>
        </div>
        <h4 className="cadastrar-cliente-step-title">Informações da Empresa</h4>
        <p className="cadastrar-cliente-step-description">Dados básicos e identificação do cliente</p>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="text"
              className="form-control"
              id="numero_dominio"
              value={formData.numero_dominio}
              onChange={(e) => handleInputChange('numero_dominio', e.target.value)}
              placeholder="Número do domínio"
              required
            />
            <label htmlFor="numero_dominio">
              Número Domínio <span className="text-danger">*</span>
            </label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="text"
              className="form-control"
              id="empresa"
              value={formData.empresa}
              onChange={(e) => handleInputChange('empresa', e.target.value)}
              placeholder="Nome da empresa"
            />
            <label htmlFor="empresa">Nome da Empresa <span className="text-danger">*</span></label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="url"
              className="form-control"
              id="drive_cliente"
              value={formData.drive_cliente}
              onChange={(e) => handleInputChange('drive_cliente', e.target.value)}
              placeholder="Link do drive"
            />
            <label htmlFor="drive_cliente">Drive do Cliente</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="number"
              className="form-control"
              id="dt"
              value={formData.dt}
              onChange={(e) => handleInputChange('dt', e.target.value)}
              placeholder="Dia (1-31)"
              min="1"
              max="31"
            />
            <label htmlFor="dt">Dia de entrega</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <select
            className="form-select py-8 fs-15"
              id="regime"
              value={formData.regime}
              onChange={(e) => handleInputChange('regime', e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="LP">Lucro Presumido</option>
              <option value="LR">Lucro Real</option>
              <option value="SN">Simples Nacional</option>
            </select>
            <label htmlFor="regime">Regime Tributário</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <select
              className="form-select"
              id="operador"
              value={formData.operador}
              onChange={(e) => handleInputChange('operador', e.target.value)}
            >
              <option value="">Selecione...</option>
              {operadoresUnicos.map((operador) => (
                <option key={operador} value={operador}>
                  {operador}
                </option>
              ))}
            </select>
            <label htmlFor="operador">Operador Responsável</label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="cadastrar-cliente-step-content">
      <div className="cadastrar-cliente-step-header">
        <div className="cadastrar-cliente-step-icon">
          <i className="fas fa-calendar-alt"></i>
        </div>
        <h4 className="cadastrar-cliente-step-title">Configurações Operacionais</h4>
        <p className="cadastrar-cliente-step-description">Definições de competências e tipos de entrega</p>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="text"
              className="form-control"
              id="competencia_entrada"
              value={formData.competencia_entrada}
              onChange={(e) => handleInputChange('competencia_entrada', e.target.value)}
              placeholder="MM/YY"
            />
            <label htmlFor="competencia_entrada">Competência Entrada</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="text"
              className="form-control"
              id="competencia_saida"
              value={formData.competencia_saida}
              onChange={(e) => handleInputChange('competencia_saida', e.target.value)}
              placeholder="MM/YY"
            />
            <label htmlFor="competencia_saida">Competência Saída</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="text"
              className="form-control"
              id="tipo_empresa"
              value={formData.tipo_empresa}
              onChange={(e) => handleInputChange('tipo_empresa', e.target.value)}
              placeholder="Tipo da empresa"
            />
            <label htmlFor="tipo_empresa">Tipo da Empresa</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <select
              className="form-select"
              id="tipo_entrega"
              value={formData.tipo_entrega}
              onChange={(e) => handleInputChange('tipo_entrega', e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="Anual">Anual</option>
              <option value="Mensal">Mensal</option>
              <option value="Quarter">Quarter</option>
              <option value="Semestral">Semestral</option>
            </select>
            <label htmlFor="tipo_entrega">Tipo de Entrega</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <select
              className="form-select"
              id="controle_financeiro"
              value={formData.controle_financeiro}
              onChange={(e) => handleInputChange('controle_financeiro', e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
              <option value="Não tem">Não tem</option>
            </select>
            <label htmlFor="controle_financeiro">Controle Financeiro</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="text"
              className="form-control"
              id="prioridade_cs"
              value={formData.prioridade_cs}
              onChange={(e) => handleInputChange('prioridade_cs', e.target.value)}
              placeholder="Prioridade CS"
            />
            <label htmlFor="prioridade_cs">Prioridade CS</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="date"
              className="form-control"
              id="ultima_entrega"
              value={formData.ultima_entrega}
              onChange={(e) => handleInputChange('ultima_entrega', e.target.value)}
            />
            <label htmlFor="ultima_entrega">Última Entrega</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="date"
              className="form-control"
              id="proxima_entrega"
              value={formData.proxima_entrega}
              onChange={(e) => handleInputChange('proxima_entrega', e.target.value)}
            />
            <label htmlFor="proxima_entrega">Próxima Entrega</label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="cadastrar-cliente-step-content">
      <div className="cadastrar-cliente-step-header">
        <div className="cadastrar-cliente-step-icon">
          <i className="fas fa-chart-bar"></i>
        </div>
        <h4 className="cadastrar-cliente-step-title">Business Intelligence</h4>
        <p className="cadastrar-cliente-step-description">Configurações de BI e informações adicionais</p>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="url"
              className="form-control"
              id="link_bi"
              value={formData.link_bi}
              onChange={(e) => handleInputChange('link_bi', e.target.value)}
              placeholder="Link do BI"
            />
            <label htmlFor="link_bi">Link do BI</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="text"
              className="form-control"
              id="senha_bi"
              value={formData.senha_bi}
              onChange={(e) => handleInputChange('senha_bi', e.target.value)}
              placeholder="Senha do BI"
            />
            <label htmlFor="senha_bi">Senha do BI</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <input
              type="text"
              className="form-control"
              id="tipo_bi"
              value={formData.tipo_bi}
              onChange={(e) => handleInputChange('tipo_bi', e.target.value)}
              placeholder="Tipo do BI"
            />
            <label htmlFor="tipo_bi">Tipo do BI</label>
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-floating">
            <select
              className="form-select"
              id="bi_conferido"
              value={formData.bi_conferido}
              onChange={(e) => handleInputChange('bi_conferido', e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
            <label htmlFor="bi_conferido">BI Conferido</label>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="cadastrar-cliente-page">
      <div className="cadastrar-cliente-container">
        <div className="cadastrar-cliente-form-container">
          {/* Header */}
          <div className="cadastrar-cliente-form-header">
            <button 
              className="cadastrar-cliente-btn-back"
              onClick={() => window.location.href = '/Contabilidade'}
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            <div className="cadastrar-cliente-header-content">
              <h1 className="cadastrar-cliente-form-title">Cadastrar Novo Cliente</h1>
              <p className="cadastrar-cliente-form-subtitle">Preencha as informações do cliente</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="cadastrar-cliente-progress-container">
            <div className="cadastrar-cliente-progress-bar">
              {[1, 2, 3].map((step) => (
                <div key={step} className="cadastrar-cliente-progress-step-container">
                  <div className={`cadastrar-cliente-progress-step ${currentStep >= step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}>
                    {currentStep > step ? (
                      <i className="fas fa-check"></i>
                    ) : (
                      step
                    )}
                  </div>
                  {step < totalSteps && <div className={`cadastrar-cliente-progress-line ${currentStep > step ? 'completed' : ''}`}></div>}
                </div>
              ))}
            </div>
            <div className="cadastrar-cliente-step-labels">
              <span className={currentStep >= 1 ? 'active' : ''}>Empresa</span>
              <span className={currentStep >= 2 ? 'active' : ''}>Operacional</span>
              <span className={currentStep >= 3 ? 'active' : ''}>BI</span>
            </div>
          </div>

          {/* Message Alert */}
          {message && (
            <div className={`cadastrar-cliente-custom-alert ${message.includes('Erro') ? 'error' : 'success'}`}>
              <div className="cadastrar-cliente-alert-content">
                <i className={`fas ${message.includes('Erro') ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
                <span>{message}</span>
              </div>
              <button className="cadastrar-cliente-alert-close" onClick={() => setMessage('')}>
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="multi-step-form">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            {/* Navigation Buttons */}
            <div className="cadastrar-cliente-form-navigation">
              <div className="cadastrar-cliente-nav-left">
                {currentStep > 1 && (
                  <button
                    type="button"
                    className="cadastrar-cliente-btn cadastrar-cliente-btn-outline"
                    onClick={prevStep}
                    disabled={loading}
                  >
                    <i className="fas fa-chevron-left me-2"></i>
                    Anterior
                  </button>
                )}
              </div>
              
              <div className="cadastrar-cliente-nav-right">
                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    className="cadastrar-cliente-btn cadastrar-cliente-btn-primary"
                    onClick={nextStep}
                    disabled={!canProceedToNext() || loading}
                  >
                    Próximo
                    <i className="fas fa-chevron-right ms-2"></i>
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="cadastrar-cliente-btn cadastrar-cliente-btn-success"
                    disabled={loading || !canProceedToNext()}
                  >
                    {loading ? (
                      <>
                        <span className="cadastrar-cliente-spinner me-2"></span>
                        Cadastrando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save me-2"></i>
                        Cadastrar Cliente
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Info Box */}
          <div className="cadastrar-cliente-info-box">
            <div className="cadastrar-cliente-info-icon">
              <i className="fas fa-info-circle"></i>
            </div>
            <div className="cadastrar-cliente-info-content">
              <h6>Informações importantes</h6>
              <ul>
                <li>Campos marcados com <span className="text-danger">*</span> são obrigatórios</li>
                <li>O sistema calculará automaticamente as próximas entregas</li>
                <li>Todos os campos podem ser editados posteriormente</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CadastrarCliente;