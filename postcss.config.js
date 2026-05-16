// Tailwind CSS v4 uses the dedicated @tailwindcss/postcss plugin.
// autoprefixer kept for vendor prefix coverage on older Electron Chromium versions.
// CommonJS export because package.json has "type": "commonjs" (Electron main).
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
