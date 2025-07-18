import React from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import '../styles/main.css'; 

const MainLayout = ({ children }) => {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div style={{ marginLeft: '6rem', padding: '2rem', width: '100%' }}>
        <Header />
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
