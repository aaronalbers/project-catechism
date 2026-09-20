import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// GitHub Pages serves the site from /<repo>/; local dev serves from /.
const base = process.env.GITHUB_PAGES_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    // The map, graph and 3D panels are dynamic imports, so their libraries already land in their own chunks.
  },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['kokoro-js', '@huggingface/transformers'] },
});
