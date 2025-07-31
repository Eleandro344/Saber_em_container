import React from 'react';
import '../styles/footer.css';

const Footer = () => {
  return (
    <footer className="text-footer text-white text-center py-3 fixed-bottom">
      <div className="container d-flex justify-content-between">
        <span className="footer-left">
          © 2025 Saber Comece. Todos os direitos reservados.
        </span>
        <a
          href="https://www.linkedin.com/in/eleandro-martins-a466ba265/"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-right text-white text-decoration-none"
        >
          Desenvolvido por Eleandro S. Martins
        </a>
      </div>
    </footer>
  );
};

export default Footer;
