import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const isTokenValid = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Date.now() / 1000;
    return payload.exp && payload.exp > now;
  } catch (e) {
    console.warn('Token inválido ou malformado:', e);
    return false;
  }
};

const PrivateRoute = () => {
  const token = localStorage.getItem('access');

  if (!token || !isTokenValid(token)) {
    // Token expirado ou inválido, limpa o localStorage
    localStorage.removeItem('access');
    localStorage.removeItem('refresh'); // caso use refresh também
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
