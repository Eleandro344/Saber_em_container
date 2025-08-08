import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo-comece.svg';
import '../styles/login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  const decodeJwt = (token) => {
    try {
      const base64Payload = token.split('.')[1];
      const payload = atob(base64Payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(payload)));
    } catch (e) {
      console.error("Erro ao decodificar JWT:", e);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE}/api/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Salva tokens no localStorage
        localStorage.setItem('access', data.access);
        localStorage.setItem('refresh', data.refresh);

        // Decodifica JWT e armazena o nome do usuário
        const decoded = decodeJwt(data.access);
        if (decoded && decoded.first_name) {
          localStorage.setItem('firstName', decoded.first_name);
        }

        // Redireciona para página protegida
        navigate('/home');
      } else {
        setErro('Email ou senha inválidos');
      }
    } catch (err) {
      console.error("Erro ao fazer login:", err);
      setErro('Erro ao conectar com o servidor. Tente novamente.');
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card p-4 shadow" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="text-center mb-4">
          <img src={logo} alt="Logo" style={{ maxHeight: '50px' }} />
          <p className="header-text2">Saber Comece</p>
        </div>
        <h5 className="text-center mb-3">Acesse sua conta</h5>
        {erro && <div className="alert alert-danger">{erro}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label>Usuário</label>
            <input
              type="text"
              className="form-control"
              placeholder="Digite seu usuário"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <label>Senha</label>
            <input
              type="password"
              className="form-control"
              placeholder="Digite sua senha"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary w-100">
            Entrar
          </button>
          <div className="text-end mb-4" style={{ fontSize: '0.85rem', color: '#888', marginTop: '10px' }}>
            V1.7.31
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
