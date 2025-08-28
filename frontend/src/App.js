import { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Home from './pages/Home';
import Login from './pages/Login';
import Logout from './pages/Logout';
import PrivateRoute from './routes/PrivateRoute';
import Kanban from './pages/Kanban';
import Tarefas from './pages/Tarefas';
import IntegraContador from './pages/IntegraContador';
import Dctfweb from './pages/Dctfweb'; // ✅ correto
import Dividas from './pages/Dividas';
import Das from './pages/Das';
import Enviaremaildp from './pages/Enviaremaildp';
import Contabilidade from './pages/Contabilidade';
import Textolivre from './pages/Textolivre';
const LayoutWrapper = ({ children }) => {
  const location = useLocation();
  const hideHeaderRoutes = ['/login', '/kanban', '/tarefas', '/IntegraContador','/Dctfweb','/Dividas','/das','/Enviaremaildp','/contabilidade','/Textolivre','/Contabilidade'];
  const isHeaderHidden = hideHeaderRoutes.includes(location.pathname);

  return (
    <div style={{ display: 'flex' }}>
      {location.pathname !== '/login' && <Sidebar />}
      <div
        style={{
          marginLeft: location.pathname !== '/login' ? '6rem' : '0',
          padding: '2rem',
          width: '100%',
        }}
      >
        {!isHeaderHidden && <Header />}
        {children}
      </div>
    </div>
  );
};

function App() {
  useEffect(() => {
    const interval = setInterval(async () => {
      const refreshToken = localStorage.getItem('refresh');

      if (!refreshToken) return;

      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (!response.ok) {
          console.warn(`Falha ao renovar token (status: ${response.status})`);
          localStorage.removeItem('access');
          localStorage.removeItem('refresh');
          window.location.href = '/login';
          return;
        }

        const data = await response.json();
        if (data.access) {
          localStorage.setItem('access', data.access);
        }
      } catch (error) {
        console.error('Erro ao tentar renovar token:', error);
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        window.location.href = '/login';
      }
    }, 4 * 60 * 1000); // a cada 4 minutos

    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <LayoutWrapper>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/logout" element={<Logout />} />
          <Route element={<PrivateRoute />}>
            <Route path="/home" element={<Home />} />
            <Route path="/kanban" element={<Kanban />} />
            <Route path="/tarefas" element={<Tarefas />} />
            <Route path="/IntegraContador" element={<IntegraContador />} />
            <Route path="/Dctfweb" element={<Dctfweb />} />
            <Route path="/Dividas" element={<Dividas />} />
            <Route path="/Das" element={<Das />} />
            <Route path="/Enviaremaildp" element={<Enviaremaildp />} />
            <Route path="/Contabilidade" element={<Contabilidade />} />
            <Route path="/Textolivre" element={<Textolivre />} />
          </Route>
        </Routes>
      </LayoutWrapper>
    </Router>
  );
}

export default App;
