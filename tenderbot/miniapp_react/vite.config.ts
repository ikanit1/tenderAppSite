import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// The app is served at /miniapp/ by FastAPI.
// Assets are served at /miniapp/assets/ via a StaticFiles mount added to web/main.py.
export default defineConfig({
  plugins: [react()],
  base: '/miniapp/',
  build: {
    outDir: path.resolve(__dirname, '../web/static/miniapp/dist'),
    assetsDir: 'assets',
    emptyOutDir: true,
  },
})
