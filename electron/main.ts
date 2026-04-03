import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

import type { AppStatus } from '../src/types';
import { registerPathIpc } from './ipc/registerPathIpc';
import { registerPresetIpc } from './ipc/registerPresetIpc';
import { registerScannerIpc } from './ipc/registerScannerIpc';
import { registerSettingsIpc } from './ipc/registerSettingsIpc';
import { logger } from './modules/logger';
import { startPreset } from './modules/appLauncher';
import { confirmStop, stopPreset } from './modules/appKiller';
import { getStatuses, startMonitoring, stopMonitoring, subscribeToStatuses } from './modules/appMonitor';
import { getRuntimePaths } from './modules/runtimePaths';
import { getSettings, shouldHideWindowOnClose } from './modules/settingsService';
import { destroyTray, syncTrayState, syncTrayStateFromSettings } from './modules/trayService';

const APP_ICON_PATH = path.resolve(process.cwd(), 'assets', 'icons', 'Feibi.png');

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let unsubscribeStatuses: (() => void) | null = null;
const MODULE_NAME = 'main.ts';

function getMainWindow(): BrowserWindow | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  return mainWindow;
}

async function syncTrayWithCurrentSettings(): Promise<void> {
  const settings = await getSettings();
  await syncTrayStateFromSettings({
    settings,
    getWindow: () => getMainWindow(),
  });
}

function configureProjectRuntime(): void {
  const runtimePaths = getRuntimePaths();

  app.setPath('userData', runtimePaths.userDataDir);
  app.setPath('sessionData', runtimePaths.sessionDataDir);
  app.setPath('logs', runtimePaths.logsDir);
  app.commandLine.appendSwitch('disk-cache-dir', runtimePaths.cacheDir);

  logger.info(MODULE_NAME, `运行时目录已初始化：${runtimePaths.runtimeRoot}`);
}

// 为了把最新应用状态推送到当前 renderer 进程。
function sendStatuses(statuses: AppStatus[]): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('monitor:statusUpdate', statuses);
  logger.info(MODULE_NAME, `推送应用状态更新，数量：${statuses.length}`);
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
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  logger.info(MODULE_NAME, `创建主窗口，图标：${APP_ICON_PATH}`);

  mainWindow.on('close', async (event) => {
    if (isQuitting) {
      return;
    }

    if (await shouldHideWindowOnClose()) {
      syncTrayState({
        enabled: true,
        getWindow: () => getMainWindow(),
      });
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
  registerPathIpc();
  registerPresetIpc();
  registerScannerIpc();
  registerSettingsIpc({
    onSettingsSaved: async (settings) => {
      await syncTrayStateFromSettings({
        settings,
        getWindow: () => getMainWindow(),
      });
    },
  });
  ipcMain.handle('launcher:startPreset', async (_event, presetId: string) => startPreset(presetId));
  ipcMain.handle('killer:stopPreset', async (_event, presetId: string) => stopPreset(presetId));
  ipcMain.handle('killer:confirmStop', async (_event, presetId: string) => confirmStop(presetId));
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
  void syncTrayWithCurrentSettings();
  void startMonitoring();

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
  stopMonitoring();
  destroyTray();
  logger.info(MODULE_NAME, '应用已退出');
});
