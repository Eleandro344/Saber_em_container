// src/pages/Enviaremaildp.js
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import '../styles/enviaremaildp.css';

const Enviaremaildp = () => {
  const [arquivo, setArquivo] = useState(null);
  const [dados, setDados] = useState([]);
  const [colunas, setColunas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [enviandoEmail, setEnviandoEmail] = useState({});
  const [statusEnvio, setStatusEnvio] = useState({});

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    
    if (!file) {
      setErro('');
      setDados([]);
      setColunas([]);
      setArquivo(null);
      return;
    }

    // Verificar se é um arquivo Excel
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setErro('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      return;
    }

    setArquivo(file);
    setCarregando(true);
    setErro('');

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Pegar a primeira aba
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Converter para JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          setErro('A planilha está vazia');
          setDados([]);
          setColunas([]);
        } else {
          // Primeira linha como cabeçalho
          let headers = jsonData[0] || [];
          const rows = jsonData.slice(1);
          
          // Renomear a coluna conforme solicitado
          headers = headers.map(header => {
            if (header === 'Valor Final da NF Julho/25') {
              return 'valor';
            }
            return header;
          });
          
          // Filtrar linhas vazias
          const filteredRows = rows.filter(row => 
            row.some(cell => cell !== undefined && cell !== null && cell !== '')
          );
          
          setColunas(headers);
          setDados(filteredRows);
          
          if (filteredRows.length === 0) {
            setErro('Não há dados na planilha (apenas cabeçalho encontrado)');
          }
        }
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        setErro('Erro ao processar o arquivo. Verifique se é um arquivo Excel válido.');
        setDados([]);
        setColunas([]);
      } finally {
        setCarregando(false);
      }
    };

    reader.onerror = () => {
      setErro('Erro ao ler o arquivo');
      setCarregando(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const limparDados = () => {
    setArquivo(null);
    setDados([]);
    setColunas([]);
    setErro('');
    setStatusEnvio({});
    // Limpar o input file
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const formatarValor = (valor) => {
    if (valor === undefined || valor === null) {
      return '';
    }
    
    // Se for número, formatar
    if (typeof valor === 'number') {
      return valor.toLocaleString('pt-BR');
    }
    
    return String(valor);
  };

  const obterDadosLinha = (linha, indexLinha) => {
    const dadosLinha = {};
    colunas.forEach((coluna, index) => {
      dadosLinha[coluna] = linha[index];
    });
    return dadosLinha;
  };

  const formatarMoeda = (valor) => {
    if (!valor) return 'R$ 0,00';
    
    const numero = typeof valor === 'number' ? valor : parseFloat(valor);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numero);
  };

  const handleEnviarEmail = async (indexLinha) => {
    const dadosLinha = obterDadosLinha(dados[indexLinha], indexLinha);
    
    // Validar se tem email
    const email = dadosLinha['E-MAIL DO PJ'];
    if (!email) {
      setStatusEnvio(prev => ({
        ...prev,
        [indexLinha]: { tipo: 'erro', mensagem: 'Email não encontrado' }
      }));
      return;
    }

    // Validar se tem valor
    const valor = dadosLinha['valor'];
    if (!valor) {
      setStatusEnvio(prev => ({
        ...prev,
        [indexLinha]: { tipo: 'erro', mensagem: 'Valor não encontrado' }
      }));
      return;
    }

    setEnviandoEmail(prev => ({ ...prev, [indexLinha]: true }));
    setStatusEnvio(prev => ({
      ...prev,
      [indexLinha]: { tipo: 'enviando', mensagem: 'Enviando...' }
    }));

    try {
      // Obter mês/ano atual
      const dataAtual = new Date();
      const mesAno = `${String(dataAtual.getMonth() + 1).padStart(2, '0')}/${dataAtual.getFullYear()}`;
      
      // Obter o nome do emissor da NF
      const emissorNF = dadosLinha['Emissor da NF'] || 'Mecanizade';
      
      // Montar o corpo do email
      const corpoEmail = `

          
          <h2 style="color: #2c3e50; text-align: center;">Nota Fiscal – ${mesAno}</h2>
          
          <p style="font-size: 16px; color: #34495e;">Olá, ${emissorNF}!</p>
          
          <p style="font-size: 16px; color: #34495e;">
            Piscou e já chegou a hora de emitir sua nota fiscal e garantir o seu dim-dim! 💰
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="font-size: 18px; color: #2c3e50; margin: 0;">
              <strong>O valor da sua NF deste mês é de ${formatarMoeda(valor)}</strong>
            </p>
          </div>
          
          <p style="font-size: 16px; color: #34495e;">
            Não esqueça de enviar a nota, hein? É só mandar por este 
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSfAZlhZySK6hVlhIPcgw2po5I8AA9GfOXYoixt5nXcxWUEbBQ/formrestricted" 
              style="color: #2980b9; text-decoration: underline;" 
              target="_blank">
              formulário
            </a>.
          </p>
          
          <p style="font-size: 16px; color: #34495e;">
            Qualquer dúvida, é só me chamar!
          </p>
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin:left:0 ; margin-right: auto; padding: 20px;">
        <div style="margin-bottom: 30px; text-align: left;">
          <img src="cid:logo2" alt="Logo" style="max-width: 400px; height: auto; display: block;">
        </div>


        </div>
      `;

      const token = localStorage.getItem('access');
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/enviar-email-nf/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destinatario: email,
          assunto: `Nota Fiscal – ${mesAno}`,
          corpo_html: corpoEmail,
          dados_funcionario: {
            nome: dadosLinha['Mecanizado'] || 'Funcionário',
            empresa: dadosLinha['Empresa'] || '',
            cnpj: dadosLinha['CNPJ'] || '',
            valor: valor,
            emissor: emissorNF
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido');
      }

      setStatusEnvio(prev => ({
        ...prev,
        [indexLinha]: { 
          tipo: 'sucesso', 
          mensagem: `Email enviado com sucesso para ${email}` 
        }
      }));

    } catch (error) {
      console.error('Erro ao enviar email:', error);
      setStatusEnvio(prev => ({
        ...prev,
        [indexLinha]: { 
          tipo: 'erro', 
          mensagem: `Erro: ${error.message}` 
        }
      }));
    } finally {
      setEnviandoEmail(prev => ({ ...prev, [indexLinha]: false }));
    }
  };

  return (
    <div className="container-enviar-email-dp">
      <h2>Envio de Email - Nota Fiscal</h2>
      
      {/* Seção de Upload */}
      <div className="secao-upload">
        <div className="upload-area">
          <div className="upload-content">
            <i className="fas fa-file-excel upload-icon"></i>
            <h4>Selecione uma planilha Excel</h4>
            <p>Formatos aceitos: .xlsx, .xls</p>
            
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="file-input"
            />
            
            <label htmlFor="file-input" className="btn btn-primary">
              <i className="fas fa-upload me-2"></i>
              Escolher Arquivo
            </label>
          </div>
        </div>
        
        {arquivo && (
          <div className="arquivo-info">
            <div className="arquivo-detalhes">
              <i className="fas fa-file-excel me-2"></i>
              <span className="arquivo-nome">{arquivo.name}</span>
              <span className="arquivo-tamanho">
                ({(arquivo.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button 
              className="btn btn-outline-danger btn-sm"
              onClick={limparDados}
              title="Remover arquivo"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}
      </div>

      {/* Loading */}
      {carregando && (
        <div className="loading-container">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
          <span className="ms-2">Processando planilha...</span>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="alert alert-danger">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {erro}
        </div>
      )}

      {/* Dados da Planilha */}
      {dados.length > 0 && (
        <div className="secao-dados">
          <div className="dados-header">
            <h4>
              <i className="fas fa-table me-2"></i>
              Dados da Planilha
            </h4>
            <div className="dados-info">
              <span className="badge bg-primary me-2">
                {colunas.length} colunas
              </span>
              <span className="badge bg-success">
                {dados.length} linhas
              </span>
            </div>
          </div>

          <div className="tabela-container">
            <table className="table table-striped table-hover">
              <thead className="table-dark">
                <tr>
                  <th className="coluna-acoes">Ações</th>
                  {colunas.map((coluna, index) => (
                    <th key={index} className="coluna-header">
                      {formatarValor(coluna) || `Coluna ${index + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.map((linha, indexLinha) => {
                  const dadosLinha = obterDadosLinha(linha, indexLinha);
                  const email = dadosLinha['E-MAIL DO PJ'];
                  const valor = dadosLinha['valor'];
                  const emissor = dadosLinha['Emissor da NF'];
                  
                  return (
                    <tr key={indexLinha}>
                      <td className="coluna-acoes">
                        <div className="acoes-container">
                          <button
                            className={`btn btn-sm ${
                              !email || !valor ? 'btn-secondary' : 'btn-primary'
                            }`}
                            onClick={() => handleEnviarEmail(indexLinha)}
                            disabled={enviandoEmail[indexLinha] || !email || !valor}
                            title={
                              !email ? 'Email não encontrado' :
                              !valor ? 'Valor não encontrado' :
                              `Enviar email de nota fiscal para ${emissor || 'Funcionário'}`
                            }
                          >
                            {enviandoEmail[indexLinha] ? (
                              <>
                                <i className="fas fa-spinner fa-spin me-1"></i>
                                Enviando...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-envelope me-1"></i>
                                Enviar NF
                              </>
                            )}
                          </button>
                          
                          {statusEnvio[indexLinha] && (
                            <div className={`status-envio ${statusEnvio[indexLinha].tipo}`}>
                              <small>
                                {statusEnvio[indexLinha].tipo === 'sucesso' && 
                                  <i className="fas fa-check-circle me-1"></i>
                                }
                                {statusEnvio[indexLinha].tipo === 'erro' && 
                                  <i className="fas fa-exclamation-circle me-1"></i>
                                }
                                {statusEnvio[indexLinha].tipo === 'enviando' && 
                                  <i className="fas fa-clock me-1"></i>
                                }
                                {statusEnvio[indexLinha].mensagem}
                              </small>
                            </div>
                          )}
                        </div>
                      </td>
                      {colunas.map((coluna, indexColuna) => (
                        <td key={indexColuna} className="celula-dados">
                          {coluna === 'valor' && linha[indexColuna] 
                            ? formatarMoeda(linha[indexColuna])
                            : formatarValor(linha[indexColuna])
                          }
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {dados.length > 10 && (
            <div className="dados-rodape">
              <small className="text-muted">
                Mostrando todas as {dados.length} linhas da planilha
              </small>
            </div>
          )}
        </div>
      )}

      {/* Estado Vazio */}
      {!carregando && !erro && dados.length === 0 && !arquivo && (
        <div className="estado-vazio">
          <i className="fas fa-file-upload empty-icon"></i>
          <h5>Nenhuma planilha carregada</h5>
          <p>Faça upload de uma planilha Excel para enviar emails de nota fiscal</p>
        </div>
      )}
    </div>
  );
};

export default Enviaremaildp;