import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load `.env*` files so `VITE_BASE_PATH` works during `vite build`.
  // Vite's `import.meta.env.BASE_URL` will then be `/catalog/` in production builds.
  const env = loadEnv(mode, process.cwd(), '');
  const envBasePath = env.VITE_BASE_PATH;
  const basePathRaw =
    envBasePath !== undefined && envBasePath !== null && String(envBasePath).trim() !== ''
      ? String(envBasePath).trim()
      : ''; // empty = root (`/`)

  // Normalize to a pathname Vite expects.
  // - '' means '/'
  // - '/catalog' or '/catalog/' both become '/catalog/'
  const basePath = basePathRaw
    ? (basePathRaw.startsWith('/') ? basePathRaw : `/${basePathRaw}`).replace(/\/?$/, '/')
    : '';
  
  return {
    base: basePath,
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:8001',
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        '/products': {
          target: 'http://localhost:8001',
          changeOrigin: true,
          secure: false,
        },
        '/static': {
          target: 'http://localhost:8001',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
});
