import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import '../styles/home.css';
import { jwtDecode } from 'jwt-decode';

const Home = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('access');
  
  // Recuperar o estado da animação do localStorage ou começar do 0
  const [animacaoAtual, setAnimacaoAtual] = useState(() => {
    const savedAnimacao = localStorage.getItem('animacaoAtual');
    return savedAnimacao ? parseInt(savedAnimacao, 10) : 0;
  });

  // Array com as URLs das animações
  const animacoes = [
    'https://lottie.host/embed/d65147e0-457f-4c24-8653-a5e93254dbea/36baEEoYXa.json',
    'https://lottie.host/embed/4a38ddaf-5b65-4a65-b537-a7be7ce54a49/x7ymJTtuXu.json',
    'https://lottie.host/embed/45af3a4c-75e6-42ba-b74b-c9a98e1639a3/r2rPa6bgO4.json'
  ];

  let username = 'usuário';

  if (token) {
    try {
      const decoded = jwtDecode(token);
      username = decoded.first_name || decoded.username || decoded.sub || 'usuário';
    } catch (e) {
      console.error('Erro ao decodificar token:', e);
    }
  }

  // useEffect para rotação das animações
  useEffect(() => {
    const intervalAnimacao = setInterval(() => {
      setAnimacaoAtual(prevAnimacao => {
        const novaAnimacao = (prevAnimacao + 1) % animacoes.length;
        // Salvar no localStorage sempre que mudar
        localStorage.setItem('animacaoAtual', novaAnimacao.toString());
        return novaAnimacao;
      });
    }, 4000); // 4 segundos

    // Cleanup do interval quando o componente desmontar
    return () => clearInterval(intervalAnimacao);
  }, [animacoes.length]);

  // useEffect para salvar o estado inicial no localStorage
  useEffect(() => {
    localStorage.setItem('animacaoAtual', animacaoAtual.toString());
  }, [animacaoAtual]);

  // useEffect para o botão rotativo (mantido o original)
  useEffect(() => {
    const button = document.getElementById('rotateButton');

    const handleMouseOver = () => {
      if (button) button.classList.add('rotate');
    };

    const handleMouseOut = () => {
      if (button) button.classList.remove('rotate');
    };

    if (button) {
      button.addEventListener('mouseover', handleMouseOver);
      button.addEventListener('mouseout', handleMouseOut);
    }

    return () => {
      if (button) {
        button.removeEventListener('mouseover', handleMouseOver);
        button.removeEventListener('mouseout', handleMouseOut);
      }
    };
  }, []);

  return (
    <div
      className="content d-flex flex-column justify-content-center align-items-center"
      style={{ height: '100vh' }}
    >
      {/* Ícone e nome do usuário no canto superior direito */}
      <i
        className="fa fa-user"
        style={{
          position: 'absolute',
          top: '150px',
          right: '80px',
          fontSize: '18px',
          color: '#222222',
          fontWeight: 'bold',
        }}
      ></i>

      <h2 className="text-user">Olá, {username}</h2>

      {/* Botão de sair fixo */}
      <button
        className="btn btn-danger logout-button"
        onClick={() => navigate('/logout')}
      >
        Sair
      </button>

      {/* Animação Rotativa */}
      <div
        className="animation-container d-flex justify-content-center align-items-center"
        style={{ margin: '50px 0' }}
      >
        <iframe
          className="animation3"
          src={animacoes[animacaoAtual]}
          title="Lottie Animation"
          key={animacaoAtual} // Force re-render quando mudar a animação
          style={{
            width: '400px',
            height: '500px',
            border: 'none',
            marginTop: '100px',
            marginLeft: '-100px',
          }}
        />
      </div>

      {/* Novidade sobre Pendência Fiscal (abaixo da animação) */}
      <div
        className="alert alert-danger text-center"
        style={{ maxWidth: '600px', marginBottom: '30px' }}
      >
        <strong>🆕 Novidade:</strong> Olá <strong> DP</strong>, o menu de DCTFWeb foi atualizado. Aproveite as novas funcionalidades!
      </div>

      {/* Botão para continuar */}
      <div className="d-flex justify-content-center mb-5">
        <button
          id="rotateButton"
          className="btn custom-button btn-lg active"
          onClick={() => navigate('/tarefas')}
        >
          Continuar para o menu principal
        </button>
      </div>

      <Footer />
    </div>
  );
};

export default Home;