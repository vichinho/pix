// Preload mínimo y seguro (contextIsolation + sandbox). Expone solo una función
// para avisar al proceso principal cuando la animación de bienvenida termina,
// de modo que los botones de ventana aparezcan recién entonces.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pixDesktop', {
  splashDone: () => ipcRenderer.send('pix:splash-done'),
});
