import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { profileIndex } from './scripts/vite-profile-index.mjs';

export default defineConfig({
  plugins: [profileIndex()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
