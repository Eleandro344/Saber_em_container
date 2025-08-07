import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import '../styles/home.css';
import { jwtDecode } from 'jwt-decode';

const Home = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('access');

  let username = 'usuário';

  if (token) {
    try {
      const decoded = jwtDecode(token);
      username = decoded.first_name || decoded.username || 'usuário';
    } catch (e) {
      console.error('Erro ao decodificar token:', e);
    }
  }

  useEffect(() => {
    const button = document.getElementById('rotateButton');

    if (button) {
      button.addEventListener('mouseover', () => {
        button.classList.add('rotate');
      });

      button.addEventListener('mouseout', () => {
        button.classList.remove('rotate');
      });
    }

    return () => {
      if (button) {
        button.removeEventListener('mouseover', () => {});
        button.removeEventListener('mouseout', () => {});
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

      {/* Animação */}
      <div
        className="animation-container d-flex justify-content-center align-items-center"
        style={{ margin: '50px 0' }}
      >
        <iframe
          className="animation3"
          src="https://lottie.host/embed/45af3a4c-75e6-42ba-b74b-c9a98e1639a3/r2rPa6bgO4.json"
          title="Lottie Animation"
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
        <strong>🆕 Novidade:</strong> Olá  <strong> DP</strong>, o menu de DCTFWeb foi atualizado. Aproveite as novas funcionalidades!
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
