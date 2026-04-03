import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import path from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: {
      outDir: 'dist-electron/main',
      lib: {
        entry: 'electron/main.ts',
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.js',
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      outDir: 'dist-electron/preload',
      lib: {
        entry: 'electron/preload.ts',
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.js',
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'dist-electron/renderer',
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
      },
    },
    plugins: [react()],
  },
});

