import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022' }, // top-level await dipakai di src/lib/api.js
  esbuild: { target: 'es2022' },
});
