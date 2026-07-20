import { createRoot } from 'react-dom/client';
import { setAuthTokenGetter } from '@visit-control/api-client';
import App from './App';
import './index.css';

// Configura o cliente de API para ler o token de autenticação do localStorage
// em todas as requisições autenticadas.
setAuthTokenGetter(() => localStorage.getItem('auth_token'));

createRoot(document.getElementById('root')!).render(<App />);
