import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

import { scanInstalledApps } from './appScanner';
import { logger } from './logger';
import {
  confirmStop,
  getPresets,
  getSettings,
  getStatuses,
  savePresets,
  saveSettings,
  startPreset,
  stopPreset,
  subscribeToStatuses,
} from './mockBackend';
import { getRuntimePaths } from './runtimePaths';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let unsubscribeStatuses: (() => void) | null = null;
const MODULE_NAME = 'main.ts';

function configureProjectRuntime(): void {
  const runtimePaths = getRuntimePaths();

  app.setPath('userData', runtimePaths.userDataDir);
  app.setPath('sessionData', runtimePaths.sessionDataDir);
  app.setPath('logs', runtimePaths.logsDir);
  app.commandLine.appendSwitch('disk-cache-dir', runtimePaths.cacheDir);

  logger.info(MODULE_NAME, `运行时目录已初始化：${runtimePaths.runtimeRoot}`);
}

function sendStatuses(statuses: Awaited<ReturnType<typeof getStatuses>>): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('monitor:statusUpdate', statuses);
  logger.info(MODULE_NAME, `推送状态更新，数量：${statuses.length}`);
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
  logger.info(MODULE_NAME, '创建主窗口');

  mainWindow.on('close', async (event) => {
    if (isQuitting) {
      return;
    }

    const settings = await getSettings();
    if (settings.runInBackground) {
      event.preventDefault();
      mainWindow?.hide();
      logger.info(MODULE_NAME, '根据设置隐藏窗口到后台');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    logger.info(MODULE_NAME, '主窗口已关闭');
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    logger.info(MODULE_NAME, `加载开发地址：${process.env.VITE_DEV_SERVER_URL}`);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    logger.info(MODULE_NAME, '加载打包后的 renderer 页面');
  }
}

function registerIpcHandlers(): void {
  logger.info(MODULE_NAME, '注册 IPC 处理器');
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
    logger.info(MODULE_NAME, 'renderer 已订阅状态更新');
  });
}

configureProjectRuntime();

app.whenReady().then(() => {
  logger.info(MODULE_NAME, 'Electron 主进程已就绪');
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
    logger.info(MODULE_NAME, '应用重新激活并显示主窗口');
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  logger.info(MODULE_NAME, '应用准备退出');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  unsubscribeStatuses?.();
  logger.info(MODULE_NAME, '应用已退出');
});

