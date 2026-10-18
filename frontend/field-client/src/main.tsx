import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import './index.css';

if (window.isSecureContext) registerSW({ immediate: true });
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter basename="/field"><AuthProvider><App/></AuthProvider></BrowserRouter></StrictMode>);

