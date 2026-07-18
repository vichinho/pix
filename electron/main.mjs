// Proceso principal de Electron para PIX.
//
// Reutiliza el backend Express existente: lo arranca en un puerto local libre
// dentro de este mismo proceso y abre una ventana apuntando a él. Los datos del
// usuario (ajustes, identidad, caché de partidas) se guardan en la carpeta de
// datos del sistema operativo, no dentro del paquete de la app (que es de solo
// lectura). Así la clave de la Riot API y el historial sobreviven a las
// actualizaciones.
import { app, BrowserWindow, shell } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Una sola instancia: si ya hay una abierta, enfocamos esa y salimos.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

/** @type {import('node:http').Server | null} */
let httpServer = null;

async function boot() {
  // El backend compilado vive en ../dist/index.js respecto a este archivo tanto
  // en desarrollo como empaquetado (electron-builder conserva la estructura).
  const indexUrl = pathToFileURL(join(here, '..', 'dist', 'index.js')).href;
  const { startServer } = await import(indexUrl);
  const dataDir = join(app.getPath('userData'), 'data');
  const { server, port } = await startServer({ dataDir, port: 0 });
  httpServer = server;
  return port;
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#0e0f13',
    title: 'PIX',
    autoHideMenuBar: true,
    webPreferences: {
      // La UI es una web estática servida localmente; no necesita acceso a Node.
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(`http://127.0.0.1:${port}`);

  // Los enlaces externos (developer.riotgames.com, etc.) se abren en el
  // navegador del sistema, no dentro de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1')) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(async () => {
  let port;
  try {
    port = await boot();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PIX] No se pudo arrancar el backend:', err);
    app.quit();
    return;
  }
  createWindow(port);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
  });
});

app.on('window-all-closed', () => {
  httpServer?.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  httpServer?.close();
});
