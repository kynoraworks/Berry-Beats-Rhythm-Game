import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any static host or sub-path.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
});
