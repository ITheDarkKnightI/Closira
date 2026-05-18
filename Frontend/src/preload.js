const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Screen capture
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  // Overlay
  showOverlay: () => ipcRenderer.invoke('show-overlay'),
  hideOverlay: () => ipcRenderer.invoke('hide-overlay'),

  // Events from main
  onRegionSelected: (cb) => ipcRenderer.on('region-selected', (_, region) => cb(region)),
  onOverlayCancelled: (cb) => ipcRenderer.on('overlay-cancelled', () => cb()),
  onTriggerCapture: (cb) => ipcRenderer.on('trigger-capture', () => cb()),

  // Overlay → main
  sendRegionSelected: (region) => ipcRenderer.send('region-selected', region),
  sendOverlayCancelled: () => ipcRenderer.send('overlay-cancelled'),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
});
