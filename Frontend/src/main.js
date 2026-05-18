const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let overlayWindow;
let tray;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 750,
    minHeight: 500,
    frame: false,
    transparent: false,
    backgroundColor: '#0f0f13',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hidden',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.hide();
}

// Capture screen and return base64 image
ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    if (sources.length === 0) throw new Error('No screen sources found');

    const source = sources[0];
    const thumbnail = source.thumbnail;
    const dataURL = thumbnail.toDataURL();
    return { success: true, dataURL };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Show overlay for region selection
ipcMain.handle('show-overlay', () => {
  if (overlayWindow) {
    overlayWindow.show();
    overlayWindow.focus();
  }
});

ipcMain.handle('hide-overlay', () => {
  if (overlayWindow) overlayWindow.hide();
});

// Receive selected region from overlay, send to main window
ipcMain.on('region-selected', (event, region) => {
  if (overlayWindow) overlayWindow.hide();
  if (mainWindow) mainWindow.webContents.send('region-selected', region);
});

ipcMain.on('overlay-cancelled', () => {
  if (overlayWindow) overlayWindow.hide();
  if (mainWindow) mainWindow.webContents.send('overlay-cancelled');
});

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close', () => app.quit());

app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();

  // Global shortcut: Ctrl+Shift+T to trigger capture
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('trigger-capture');
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
