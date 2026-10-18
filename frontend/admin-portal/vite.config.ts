import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: apiProxy() },
});

function apiProxy() {
  const route = (target: string, stripDocuments = false) => ({ target, changeOrigin: true,
    rewrite: (path: string) => stripDocuments ? path.replace(/^\/api\/documents/, '') : path.replace(/^\/api/, '') });
  return {
    '/api/documents': route('http://127.0.0.1:3002', true),
    '/api/auth': route('http://127.0.0.1:8001'), '/api/professionals': route('http://127.0.0.1:8001'),
    '/api/patients': route('http://127.0.0.1:8081'),
    '/api/medical-records': route('http://127.0.0.1:3001'), '/api/encounters': route('http://127.0.0.1:3001'),
    '/api/medications': route('http://127.0.0.1:8002'), '/api/medication-changes': route('http://127.0.0.1:8002'),
    '/api/sync': route('http://127.0.0.1:8082'), '/api/audit': route('http://127.0.0.1:8082'),
  };
}

