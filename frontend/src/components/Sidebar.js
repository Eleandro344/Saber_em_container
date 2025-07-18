import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/sidebar.css';
import logo from '../assets/logo-comece.svg';
import { jwtDecode } from 'jwt-decode'; 

const Sidebar = () => {
  const location = useLocation();
  const token = localStorage.getItem('access');

  let username = 'usuário';

  console.log('TOKEN:', token);
  if (token) {
    try {
      const decoded = jwtDecode(token);
      console.log('DECODED JWT:', decoded); // 👈 Veja o que aparece no console
      username = decoded.first_name || decoded.username || 'usuário';
    } catch (e) {
      console.error('Erro ao decodificar token:', e);
    }
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <img src={logo} alt="Logo" className="img-fluid" />
      </div>
      <hr />
      <p className="welcome-text">Bem-vindo, {username}!</p>
      <nav className="nav flex-column">
        <Link to="/home" className={`nav-link nav-link-beat ${location.pathname === '/home' ? 'active' : ''}`}>
          <i className="fas fa-home me-2 fa-lg"></i>
          <span className="sidebar-info">Home</span>
          </Link>
          <Link to="/kanban" className={`nav-link nav-link-beat ${location.pathname === '/kanban' ? 'active' : ''}`}>
          <i className="fas fa-th-large me-2 fa-lg"></i>

          <span className="sidebar-info">Kanban</span>
          </Link>
          <Link
          to="/IntegraContador"
          className={`nav-link nav-link-beat ${location.pathname === '/IntegraContador' ? 'active' : ''}`}
        >
          <i className="fa-solid fa-folder-open me-2 fa-lg"></i>
          <span className="sidebar-info">Relatórios Fiscais</span>
        </Link>
      <Link
          to="/Dctfweb"
          className={`nav-link nav-link-beat ${location.pathname === '/Dctfweb' ? 'active' : ''}`}
        >
        <i className="fa-solid fa-file-invoice me-2 fa-2x"></i>
          <span className="sidebar-info">DCTFWEB</span>
        </Link>       
             <Link
          to="/Dividas"
          className={`nav-link nav-link-beat ${location.pathname === '/Dividas' ? 'active' : ''}`}
        >
        <i className="fa-solid fa-dollar-sign me-2 fa-2x"></i>
          <span className="sidebar-info">Pendecia Fiscal</span>
        </Link>   
      </nav>
    </div>
  );
};

export default Sidebar;
