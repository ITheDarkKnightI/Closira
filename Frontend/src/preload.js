const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Screen capture
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  // Overlay
  showOverlay: () => ipcRenderer.invoke('show-overlay'),
  hideOverlay: () => ipcRenderer.invoke('hide-overlay'),

  // Hotkey
  setHotkey: (combo) => ipcRenderer.invoke('set-hotkey', combo),

  // Popup
  showPopup: (data) => ipcRenderer.invoke('show-popup', data),
  closePopup: () => ipcRenderer.send('close-popup'),
  onPopupData: (cb) => ipcRenderer.on('popup-data', (_, data) => cb(data)),
  resizePopup: (info) => ipcRenderer.send('popup-resize', info),

  // Window state
  isMinimized: () => ipcRenderer.invoke('is-minimized'),
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  
  // Events from main
  onRegionSelected: (cb) => ipcRenderer.on('region-selected', (_, region) => cb(region)),
  onOverlayCancelled: (cb) => ipcRenderer.on('overlay-cancelled', () => cb()),
  onTriggerCapture: (cb) => ipcRenderer.on('trigger-capture', () => cb()),
  onReceivePort: (cb) => ipcRenderer.on('set-server-port', (event, port) => cb(port)),

  // Overlay → main
  sendRegionSelected: (region) => ipcRenderer.send('region-selected', region),
  sendOverlayCancelled: () => ipcRenderer.send('overlay-cancelled'),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
});
