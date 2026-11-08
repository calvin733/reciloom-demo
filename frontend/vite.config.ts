import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// URL relatif /api membuat browser dan cookie tetap berada di origin frontend.
const proxy = { '/api': { target: 'http://localhost:3000', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { host: 'localhost', port: 5173, strictPort: true, proxy },
  preview: { host: 'localhost', port: 4173, strictPort: true, proxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
  },
});
