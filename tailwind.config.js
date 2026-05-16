// Tailwind v4 auto-discovers content from @source directives in CSS,
// so this config is mostly informational/compat with older tooling.
module.exports = {
  content: ['./renderer/index.html', './renderer/src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
