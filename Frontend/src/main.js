const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut } = require('electron');
const {spawn, exec} = require('child_process');
const path = require('path');

let mainWindow;
let overlayWindow;
let popupWindow;
let currentHotkey = 'CommandOrControl+Shift+T';
let javaProcess;
let isAppQuitting = false;

// ── MAIN WINDOW ──────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900, height: 600, minWidth: 720, minHeight: 540,
    frame: false, transparent: false, backgroundColor: '#111827',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── OVERLAY WINDOW ────────────────────────────────────────
function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  overlayWindow = new BrowserWindow({
    width, height, x: 0, y: 0,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, focusable: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.hide();
}

// ── POPUP WINDOW ─────────────────────────────────────────
function createPopupWindow() {
  popupWindow = new BrowserWindow({
    width: 340, height: 160,
    frame: false, transparent: false, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, backgroundColor: '#131c2e',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });
  popupWindow.loadFile(path.join(__dirname, 'popup.html'));
  popupWindow.on('closed', () => { popupWindow = null; });
}

function calcPopupPosition(region, popupW, popupH) {
  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = display.workAreaSize;
  const MARGIN = 12;

  
  let x = region.x;
  let y = region.y + region.h + MARGIN;

  
  if (y + popupH > sh) {
    y = region.y - popupH - MARGIN;
  }
  
  if (y < 0) {
    y = sh - popupH - MARGIN;
  }

 
  x = region.x;
  
  if (x + popupW > sw) {
    x = sw - popupW - MARGIN;
  }
  
  if (x < MARGIN) x = MARGIN;

  return { x: Math.round(x), y: Math.round(y) };
}

function showPopup(data) {
  
  const sendData = () => {
    if (!popupWindow || popupWindow.isDestroyed()) return;

    
    popupWindow.webContents.send('popup-data', data);
    popupWindow.show();

  };

  if (!popupWindow || popupWindow.isDestroyed()) {
    createPopupWindow();
    popupWindow.webContents.once('did-finish-load', sendData);
  } else {
    sendData();
  }
}

function createServer(){
	return new Promise((resolve, reject) =>{
		javaProcess = spawn(getJavaPath(), ['-jar', getJarPath()]);

        javaProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('Java:', output);

            const match = output.match(/SERVER_PORT: (\d+)/);
            if (match) {
				console.log("Matched: " + match[1]);
				mainWindow.webContents.send('set-server-port', parseInt(match[1]));
                resolve(parseInt(match[1]));
            }
        });

        javaProcess.stderr.on('data', (data) => {
            console.error('Java error:', data.toString());
        });

        javaProcess.on('error', reject);
	});
}

function getJavaPath() {
	const javaExecutable = process.platform === 'win32' ? 'java.exe' : 'java';
    return path.join(getBasePath(), 'resources', 'jre', 'bin', javaExecutable);
}

function getJarPath() {
    return path.join(getBasePath(), 'resources', 'PR-backend-1.0-SNAPSHOT.jar');
}

function getBasePath() {
  if (app.isPackaged) {
    return process.resourcesPath;
  } else {
    return path.join(__dirname, '..');
  }
}

ipcMain.on('popup-resize', (event, { width, height, region }) => {
  if (!popupWindow || popupWindow.isDestroyed()) return;

  const W = Math.min(Math.max(width, 280), 520);
  const H = Math.min(Math.max(height, 80), 400);

  popupWindow.setSize(W, H);

  if (region && region.x != null) {
    const pos = calcPopupPosition(region, W, H);
    popupWindow.setPosition(pos.x, pos.y);
  } else {
    
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    popupWindow.setPosition(sw - W - 16, sh - H - 16);
  }
});

// ── РЕЄСТРАЦІЯ ГАРЯЧОЇ КЛАВІШІ ───────────────────────────
function registerHotkey(combo) {
  globalShortcut.unregisterAll();
  const electronCombo = combo
    .replace('Ctrl', 'Control')
    .replace('Alt', 'Alt')
    .replace('Shift', 'Shift');
  try {
    const ok = globalShortcut.register(electronCombo, () => {
      if (mainWindow) {
        mainWindow.webContents.send('trigger-capture');
      }
    });
    if (!ok) console.log('Hotkey registration failed:', electronCombo);
    else currentHotkey = combo;
  } catch(e) {
    console.log('Hotkey error:', e.message);
  }
}

// ── IPC ───────────────────────────────────────────────────
ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    if (!sources.length) throw new Error('Екран не знайдено');
    return { success: true, dataURL: sources[0].thumbnail.toDataURL() };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('show-overlay', () => {
  if (overlayWindow) { overlayWindow.show(); overlayWindow.focus(); }
});
ipcMain.handle('hide-overlay', () => {
  if (overlayWindow) overlayWindow.hide();
});
ipcMain.handle('show-popup', (event, data) => {
  showPopup(data);
});
ipcMain.handle('is-minimized', () => {
  return mainWindow ? mainWindow.isMinimized() : false;
});
ipcMain.handle('set-hotkey', (event, combo) => {
  registerHotkey(combo);
  return currentHotkey;
});

ipcMain.on('region-selected', (event, region) => {
  if (overlayWindow) overlayWindow.hide();
  if (mainWindow) mainWindow.webContents.send('region-selected', region);
});
ipcMain.on('overlay-cancelled', () => {
  if (overlayWindow) overlayWindow.hide();
  if (mainWindow) mainWindow.webContents.send('overlay-cancelled');
});
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close', () => app.quit());
ipcMain.on('close-popup', () => { if (popupWindow && !popupWindow.isDestroyed()) popupWindow.hide(); }); 

let serverPort = null;
ipcMain.handle('get-server-port', () => serverPort);
// ── APP ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  createMainWindow();
  createOverlayWindow();
  createPopupWindow();
  registerHotkey('Ctrl+Shift+T');
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
  try{
	  console.log("Create server");
	  await createServer();
  }catch(err){
	  console.error('Failed to start server:', err);
       app.quit();
  }
});

app.on('before-quit', (event) => {
  if (javaProcess && !isAppQuitting) {
    event.preventDefault();
    console.log("Stopping the Java-process...");

    if (process.platform === 'win32') {
      const command = `taskkill /pid ${javaProcess.pid} /f /t`;
      
      exec(command, (err, stdout, stderr) => {
        if (err) {
          console.error('error - taskkill:', err);
        } else {
          console.log('Java-process is killed');
        }
        
        // Close Electron
        isAppQuitting = true;
        app.quit();
      });
    } else {
      // For linux in future
	  try { javaProcess.kill('SIGKILL'); } catch (e) {}
      isAppQuitting = true;
      app.quit();
    }
  }
});

app.on('will-quit', () => {
	console.log("Exit");
	globalShortcut.unregisterAll();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
