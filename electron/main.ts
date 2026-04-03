import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

import {
  confirmStop,
  getPresets,
  getSettings,
  getStatuses,
  savePresets,
  saveSettings,
  scanInstalledApps,
  startPreset,
  stopPreset,
  subscribeToStatuses,
} from './mockBackend';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let unsubscribeStatuses: (() => void) | null = null;

function sendStatuses(statuses: Awaited<ReturnType<typeof getStatuses>>): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('monitor:statusUpdate', statuses);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#FDFBF7',
    title: 'LaunchManager',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('close', async (event) => {
    if (isQuitting) {
      return;
    }

    const settings = await getSettings();
    if (settings.runInBackground) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('preset:getAll', async () => getPresets());
  ipcMain.handle('preset:save', async (_event, presets) => savePresets(presets));
  ipcMain.handle('launcher:startPreset', async (_event, presetId: string) => startPreset(presetId));
  ipcMain.handle('killer:stopPreset', async (_event, presetId: string) => stopPreset(presetId));
  ipcMain.handle('killer:confirmStop', async (_event, presetId: string) => confirmStop(presetId));
  ipcMain.handle('settings:get', async () => getSettings());
  ipcMain.handle('settings:save', async (_event, settings) => saveSettings(settings));
  ipcMain.handle('app:scanInstalled', async () => scanInstalledApps());
  ipcMain.handle('monitor:getStatuses', async () => getStatuses());

  ipcMain.on('monitor:subscribe', async (event) => {
    event.sender.send('monitor:statusUpdate', await getStatuses());
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  unsubscribeStatuses = subscribeToStatuses((statuses) => {
    sendStatuses(statuses);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      return;
    }

    mainWindow?.show();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  unsubscribeStatuses?.();
});


