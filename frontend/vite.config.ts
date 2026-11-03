import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const env = loadEnv('development', process.cwd(), '');
export default defineConfig({ plugins: [react()], server: {
  watch: { ignored: ['**/coverage/**', '**/storybook-static/**'] },
  proxy: { '/api': { target: env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true } },
} });
