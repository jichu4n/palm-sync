import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  // We need to explicitly configure Vite to treat palm-sync as CommonJS module
  // as it is in the same monorepo. See documentation:
  // https://vitejs.dev/guide/dep-pre-bundling#monorepos-and-linked-dependencies
  optimizeDeps: {
    include: ['palm-sync'],
  },
  build: {
    commonjsOptions: {
      include: [/palm-sync/, /node_modules/],
    },
  },
  // Preserve identifiers such as DLP request / response class names for better logging.
  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
  },
});
