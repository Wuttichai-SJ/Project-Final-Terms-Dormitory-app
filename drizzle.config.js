// drizzle.config.js
// Used by drizzle-kit CLI during development (e.g. `npx drizzle-kit studio`).
// The app itself boots via raw SQL migrations in main/database/migrate.js —
// this file is only needed if you want drizzle-kit to diff the schema.
const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  schema: './main/database/schema.js',
  out: './main/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    // dev sqlite created next to the project root for drizzle-kit tooling only
    url: './dormy.dev.sqlite',
  },
});
