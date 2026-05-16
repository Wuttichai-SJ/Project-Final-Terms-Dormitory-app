const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');
const path = require('node:path');

// Vite is rooted at renderer/ so all React source paths are relative to that folder.
// build output lands in renderer/dist (referenced by electron-builder).
module.exports = defineConfig({
  root: path.resolve(__dirname, 'renderer'),
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, 'renderer/dist'),
    emptyOutDir: true,
  },
});
