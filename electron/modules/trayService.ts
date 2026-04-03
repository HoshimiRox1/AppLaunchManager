import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import path from 'node:path';

import type { Settings } from '../../src/types';
import { logger } from './logger';

const MODULE_NAME = 'trayService.ts';
const ICON_RELATIVE_PATH = path.join('assets', 'icons', 'Feibi.png');

let tray: Tray | null = null;
let getMainWindow: (() => BrowserWindow | null) | null = null;

// 为了定位当前项目使用的托盘图标文件。
function getTrayIconPath(): string {
  return path.resolve(process.cwd(), ICON_RELATIVE_PATH);
}

// 为了生成当前可复用的托盘图标资源。
function createTrayIcon() {
  const icon = nativeImage.createFromPath(getTrayIconPath());
  if (icon.isEmpty()) {
    logger.warn(MODULE_NAME, `托盘图标加载失败：${getTrayIconPath()}`);
  }

  return icon.resize({ width: 16, height: 16 });
}

// 为了安全获取当前主窗口实例。
function resolveMainWindow(): BrowserWindow | null {
  if (!getMainWindow) {
    return null;
  }

  const window = getMainWindow();
  if (!window || window.isDestroyed()) {
    return null;
  }

  return window;
}

// 为了统一恢复并聚焦主窗口。
function showMainWindow(): void {
  const window = resolveMainWindow();
  if (!window) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
  logger.info(MODULE_NAME, '通过托盘恢复主窗口');
}

// 为了真正创建后台运行所需的系统托盘。
function createTray(): Tray {
  const nextTray = new Tray(createTrayIcon());
  nextTray.setToolTip('LaunchManager');
  nextTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => showMainWindow(),
      },
      {
        type: 'separator',
      },
      {
        label: '退出',
        click: () => {
          logger.info(MODULE_NAME, '通过托盘菜单退出应用');
          app.quit();
        },
      },
    ]),
  );
  nextTray.on('click', () => showMainWindow());
  logger.info(MODULE_NAME, '已创建系统托盘');
  return nextTray;
}

// 为了按后台运行策略同步托盘的创建与销毁。
export function syncTrayState(options: { enabled: boolean; getWindow: () => BrowserWindow | null }): void {
  getMainWindow = options.getWindow;

  if (options.enabled) {
    if (!tray) {
      tray = createTray();
    }
    return;
  }

  if (tray) {
    tray.destroy();
    tray = null;
    logger.info(MODULE_NAME, '已销毁系统托盘');
  }
}

// 为了在应用退出时清理托盘资源。
export function destroyTray(): void {
  if (!tray) {
    return;
  }

  tray.destroy();
  tray = null;
  logger.info(MODULE_NAME, '应用退出时清理系统托盘');
}

// 为了让设置保存后的后台运行策略能够直接驱动托盘状态。
export async function syncTrayStateFromSettings(options: {
  settings: Settings;
  getWindow: () => BrowserWindow | null;
}): Promise<void> {
  syncTrayState({
    enabled: options.settings.runInBackground,
    getWindow: options.getWindow,
  });
}
