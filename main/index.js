// Electron main process entry point.
// Owns the BrowserWindow, lifecycle, DB init, and IPC handlers.

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { initDatabase } = require('./database/client');
const { runSeed } = require('./database/seed');
const { registerAuthHandlers } = require('./handlers/authHandlers');
const { registerUserHandlers } = require('./handlers/userHandlers');

// IS_DEV is true when launched via `npm run dev` (vite dev server running on :5173).
// In production the renderer is loaded from the bundled HTML on disk.
const IS_DEV = !app.isPackaged;

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Dormy Manager',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Hard security defaults — renderer must never get raw Node.js access.
      // All privileged work goes through preload's contextBridge channel.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (IS_DEV) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Smoke-test IPC channel used by Phase 0 to prove main ↔ renderer plumbing works.
// Real domain handlers will be registered in main/handlers/* in later phases.
ipcMain.handle('app:ping', async () => {
  return {
    success: true,
    data: {
      message: 'pong from main process',
      timestamp: new Date().toISOString(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
    },
  };
});

app.whenReady().then(() => {
  // DB must be ready before handlers are registered — handlers call getDb() at request time
  initDatabase(app.getPath('userData'));
  runSeed();

  registerAuthHandlers();
  registerUserHandlers();

  createMainWindow();

  app.on('activate', () => {
    // macOS convention — reopen window if dock icon clicked with no windows open.
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
