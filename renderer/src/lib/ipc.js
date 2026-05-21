// Thin wrapper around window.electron.invoke so service files don't scatter the global reference.
export function invoke(channel, payload) {
  return window.electron.invoke(channel, payload);
}
