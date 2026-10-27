const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, dialog, Menu, session } = require('electron/main');

const appRoot = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(appRoot, 'config.json'), 'utf8'));
const rendererDir = path.join(appRoot, 'renderer');
const userData = path.join(app.getPath('appData'), 'MedicalField Socorrista');
app.setPath('userData', userData);

let mainWindow;
let localServer;

function registerDesktopProtocol() {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient('medicalfield', process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient('medicalfield');
  }
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMenu() {
  const template = [
    {
      label: 'MedicalField',
      submenu: [
        { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { label: 'Inspecionar banco local', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.toggleDevTools() },
        { type: 'separator' },
        { label: 'Sair', role: 'quit' },
      ],
    },
    {
      label: 'Visualizar',
      submenu: [
        { role: 'resetZoom', label: 'Tamanho normal' },
        { role: 'zoomIn', label: 'Aumentar' },
        { role: 'zoomOut', label: 'Diminuir' },
        { role: 'togglefullscreen', label: 'Tela cheia' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow(origin) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#f8fafc',
    title: 'MedicalField — Cliente do Socorrista',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      additionalArguments: [`--medicalfield-storage=${encodeURIComponent(path.join(userData, 'IndexedDB'))}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(`${origin}/`)) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = undefined; });
  await mainWindow.loadURL(`${origin}/field/`);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('open-url', (event) => {
    event.preventDefault();
    showWindow();
  });

  app.whenReady().then(async () => {
    registerDesktopProtocol();
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    createMenu();
    try {
      const { startLocalServer } = await import('./localServer.mjs');
      localServer = await startLocalServer({
        rendererDir,
        serverOrigin: config.serverOrigin,
        port: config.localPort,
      });
      await createWindow(localServer.origin);
    } catch (error) {
      console.error('Falha ao iniciar o MedicalField desktop', error);
      dialog.showErrorBox(
        'MedicalField não iniciou',
        `Não foi possível abrir o cliente local. ${error instanceof Error ? error.message : String(error)}`,
      );
      app.quit();
    }
  });

  app.on('activate', () => {
    if (!mainWindow && localServer) void createWindow(localServer.origin);
    else showWindow();
  });

  app.on('before-quit', () => localServer?.server.close());
  app.on('window-all-closed', () => app.quit());
}
