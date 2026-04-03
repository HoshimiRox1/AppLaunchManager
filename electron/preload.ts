import { contextBridge, ipcRenderer } from 'electron';

import type { AppStatus, ElectronAPI } from '../src/types';

const electronAPI: ElectronAPI = {
  presetGetAll: () => ipcRenderer.invoke('preset:getAll'),
  presetSave: (presets) => ipcRenderer.invoke('preset:save', presets),
  launcherStartPreset: (presetId) => ipcRenderer.invoke('launcher:startPreset', presetId),
  killerStopPreset: (presetId) => ipcRenderer.invoke('killer:stopPreset', presetId),
  killerConfirmStop: (presetId) => ipcRenderer.invoke('killer:confirmStop', presetId),
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSave: (settings) => ipcRenderer.invoke('settings:save', settings),
  appScanInstalled: () => ipcRenderer.invoke('app:scanInstalled'),
  pathGetDefaultInstallDir: (filePath) => ipcRenderer.invoke('path:getDefaultInstallDir', filePath),
  pathGetParentDir: (directoryPath) => ipcRenderer.invoke('path:getParentDir', directoryPath),
  getCurrentStatuses: () => ipcRenderer.invoke('monitor:getStatuses'),
  onStatusUpdate: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, statuses: AppStatus[]) => callback(statuses);
    ipcRenderer.on('monitor:statusUpdate', handler);
    ipcRenderer.send('monitor:subscribe');

    return () => {
      ipcRenderer.removeListener('monitor:statusUpdate', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
