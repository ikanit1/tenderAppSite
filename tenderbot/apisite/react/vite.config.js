import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // По умолчанию base пустой (для dev режима на порту 8001)
  // Для production: только если VITE_BASE_PATH явно задан в .env - используем его
  // Если VITE_BASE_PATH не задан - base будет пустым (работает и в dev, и в production через FastAPI)
  const envBasePath = process.env.VITE_BASE_PATH;
  const basePath = envBasePath !== undefined && envBasePath !== '' && envBasePath !== null
    ? envBasePath
    : ''; // По умолчанию пусто для работы без префикса
  
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
