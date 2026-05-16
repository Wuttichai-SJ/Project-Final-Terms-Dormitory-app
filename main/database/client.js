// Database singleton — opened once at app boot and shared across all handlers via getDb().
// Call initDatabase(userDataPath) from main/index.js before creating the BrowserWindow.

const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const path = require('node:path');
const schema = require('./schema');
const { runMigrations } = require('./migrate');

let _db = null;       // drizzle instance
let _sqlite = null;   // raw better-sqlite3 instance (needed for transactions / raw SQL)

/**
 * Opens (or creates) the SQLite file, runs pending migrations, and builds the
 * drizzle instance. Must be called exactly once before any handler uses getDb().
 *
 * @param {string} userDataPath - Electron's app.getPath('userData') directory
 * @returns {{ db: import('drizzle-orm/better-sqlite3').BetterSQLite3Database, sqlite: import('better-sqlite3').Database }}
 */
function initDatabase(userDataPath) {
  const dbPath = path.join(userDataPath, 'dormy.sqlite');

  _sqlite = new Database(dbPath);

  // WAL mode gives much better write throughput and allows reads while a write is in flight
  _sqlite.pragma('journal_mode = WAL');

  // SQLite foreign-key enforcement is off by default — turn it on so cascades / FKs work
  _sqlite.pragma('foreign_keys = ON');

  runMigrations(_sqlite);

  _db = drizzle(_sqlite, { schema });

  console.log(`[DB] Opened: ${dbPath}`);
  return { db: _db, sqlite: _sqlite };
}

/**
 * Returns the drizzle ORM instance.
 * Throws if initDatabase() has not been called yet.
 */
function getDb() {
  if (!_db) throw new Error('[DB] getDb() called before initDatabase().');
  return _db;
}

/**
 * Returns the raw better-sqlite3 Database instance.
 * Use this for explicit transactions or raw SQL that drizzle doesn't expose.
 */
function getSqlite() {
  if (!_sqlite) throw new Error('[DB] getSqlite() called before initDatabase().');
  return _sqlite;
}

module.exports = { initDatabase, getDb, getSqlite };
