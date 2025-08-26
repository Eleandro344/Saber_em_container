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
    console.log('DECODED JWT:', decoded);

    username = decoded.first_name || decoded.username || decoded.sub || 'usuário';

    // 👇 Ajuste manual de nomes específicos
    if (username === 'Amandacarissimi') {
      username = 'Amanda Carissimi';
    } else if (username === 'Matheusscheidt') {
      username = 'Matheus Scheidt';
          } else if (username === 'Maria') {
      username = 'Maria Eduarda';
    }

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
      <i className="fa-solid fa-folder-open me-2" style={{ fontSize: "1.3rem" }}></i>
          <span className="sidebar-info">Relatórios Fiscais</span>
        </Link>
      <Link
          to="/Dctfweb"
          className={`nav-link nav-link-beat ${location.pathname === '/Dctfweb' ? 'active' : ''}`}
        >
        <i className="fa-solid fa-file-invoice me-2 fa-lg"style={{ fontSize: "1.5rem" }}></i>
          <span className="sidebar-info">DCTFWEB</span>
        </Link>       
             <Link
          to="/Dividas"
          className={`nav-link nav-link-beat ${location.pathname === '/Dividas' ? 'active' : ''}`}
        >
        <i className="fa-solid fa-dollar-sign me-2 fa-lg"style={{ fontSize: "1.8rem" }}></i>
          <span className="sidebar-info">Pendecia Fiscal</span>
        </Link>   
        <Link
          to="/Contabilidade"
          className={`nav-link nav-link-beat ${location.pathname === '/Contabilidade' ? 'active' : ''}`}
        >
        <i className="fa-solid fa-money-bill-transfer me-2 fa-lg"style={{ fontSize: "1.4rem" }}></i>
          <span className="sidebar-info"> Contábil</span>  
        </Link>   
             <Link
          to="/das"
          className={`nav-link nav-link-beat ${location.pathname === '/Das' ? 'active' : ''}`}
        >
        <i className="fa-solid fa-money-bill-trend-up me-2 fa-lg"style={{ fontSize: "1.4rem" }}></i>
          <span className="sidebar-info">PGDAS</span>
        </Link>  
             <Link
          to="/Enviaremaildp"
          className={`nav-link nav-link-beat ${location.pathname === '/Enviaremaildp' ? 'active' : ''}`}
        >
        <i className="fa-solid fa-envelope-open-text me-2 fa-lg"style={{ fontSize: "1.4rem" }}></i>
          <span className="sidebar-info">  Envio email DP</span>
        </Link>           
      </nav>
    </div>
  );
};

export default Sidebar;
