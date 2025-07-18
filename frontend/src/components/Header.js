import React from 'react';
import '../styles/header.css';
import logo from '../assets/logo-comece.svg';

const Header = () => {
  return (
    <header className="custom-header text-center">
<img
  src={logo}
  alt="Logo"
  className="img-fluid"
  style={{ width: '180px', height: 'auto' }} // ou qualquer tamanho desejado
/>      <p className="header-text">Saber Comece</p>
    </header>
  );
};

export default Header;
