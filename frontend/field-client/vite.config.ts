import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/field/',
  plugins: [
    react(), tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MedicalField — Cliente do Socorrista', short_name: 'MedicalField',
        description: 'Registro de atendimentos de emergência com operação offline.',
        theme_color: '#0f766e', background_color: '#f8fafc', display: 'standalone',
        start_url: '/field/', scope: '/field/',
        icons: [
          { src: '/field/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/field/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/field/index.html',
        globPatterns: ['**/*.{js,css,html,svg}'],
        runtimeCaching: [],
      },
    }),
  ],
  server: { port: 5174, proxy: apiProxy() },
});

function apiProxy() {
  const route = (target: string) => ({ target, changeOrigin: true, rewrite: (path: string) => path.replace(/^\/api/, '') });
  return {
    '/api/auth': route('http://127.0.0.1:8001'), '/api/professionals': route('http://127.0.0.1:8001'),
    '/api/patients': route('http://127.0.0.1:8081'),
    '/api/medical-records': route('http://127.0.0.1:3001'), '/api/encounters': route('http://127.0.0.1:3001'),
    '/api/medications': route('http://127.0.0.1:8002'), '/api/medication-changes': route('http://127.0.0.1:8002'),
    '/api/sync': route('http://127.0.0.1:8082'), '/api/audit': route('http://127.0.0.1:8082'),
  };
}

