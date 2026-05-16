// Preload script — the ONLY bridge between the privileged main process
// and the sandboxed renderer. Only the channels exposed here are reachable
// from React via window.electron.*

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // invoke is a request/response call to a main-process ipcMain.handle channel.
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),

  // on subscribes to push events from the main process (e.g. auth:expired).
  // Returns an unsubscribe function so React effects can clean up properly.
  on: (channel, listener) => {
    const wrapped = (_event, ...args) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
