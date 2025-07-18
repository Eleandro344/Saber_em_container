import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const isTokenValid = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Date.now() / 1000;
    return payload.exp > now;
  } catch (e) {
    return false;
  }
};

const PrivateRoute = () => {
  const token = localStorage.getItem('access');
  const isAuthenticated = token && isTokenValid(token);

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;
