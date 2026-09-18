import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 8192,
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        protoIndex: resolve(root, 'prototypes/index.html'),
        protoNeon: resolve(root, 'prototypes/neon.html'),
        protoFuturistic: resolve(root, 'prototypes/futuristic.html'),
        protoRustic: resolve(root, 'prototypes/rustic.html'),
        protoClassic: resolve(root, 'prototypes/classic.html'),
        protoCandy: resolve(root, 'prototypes/candy.html'),
      },
    },
  },
  server: { host: '127.0.0.1', port: 5173 },
});
