import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Settings } from '../../src/types';
import { logger } from './logger';
import { getRuntimePaths } from './runtimePaths';

const MODULE_NAME = 'settingsService.ts';
const SETTINGS_FILE_NAME = 'settings.json';
const LEGACY_MOCK_FILE_NAME = 'launch-manager-mock.json';
const DEFAULT_SETTINGS: Settings = {
  adminMode: false,
  runInBackground: true,
  launchOnStartup: false,
};

interface LegacyMockDatabase {
  settings?: unknown;
}

// 为了获取 settingsService 的独立数据文件路径。
function getSettingsFilePath(): string {
  const dataDir = getRuntimePaths().dataDir;
  mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, SETTINGS_FILE_NAME);
}

// 为了定位旧版 mock 数据文件并执行一次性迁移。
function getLegacyMockFilePath(): string {
  const dataDir = getRuntimePaths().dataDir;
  mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, LEGACY_MOCK_FILE_NAME);
}

// 为了校验并清洗设置文件中的数据结构。
function sanitizeSettings(value: unknown): Settings | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<Settings>;
  if (
    typeof candidate.adminMode !== 'boolean' ||
    typeof candidate.runInBackground !== 'boolean' ||
    typeof candidate.launchOnStartup !== 'boolean'
  ) {
    return null;
  }

  return {
    adminMode: candidate.adminMode,
    runInBackground: candidate.runInBackground,
    launchOnStartup: candidate.launchOnStartup,
  };
}

// 为了把设置稳定写入独立存储中。
function writeSettingsFile(settings: Settings): Settings {
  const persistedSettings = sanitizeSettings(settings) ?? { ...DEFAULT_SETTINGS };
  writeFileSync(getSettingsFilePath(), JSON.stringify(persistedSettings, null, 2), 'utf8');
  logger.info(MODULE_NAME, '写入设置数据文件');
  return persistedSettings;
}

// 为了从旧版 mock 数据文件中提取可迁移的设置。
function tryReadLegacySettings(): Settings | null {
  const legacyFilePath = getLegacyMockFilePath();
  if (!existsSync(legacyFilePath)) {
    return null;
  }

  try {
    const content = readFileSync(legacyFilePath, 'utf8');
    const parsed = JSON.parse(content) as LegacyMockDatabase;
    const legacySettings = sanitizeSettings(parsed.settings);
    if (!legacySettings) {
      return null;
    }

    logger.info(MODULE_NAME, `从旧 mock 数据迁移设置成功：${legacyFilePath}`);
    return legacySettings;
  } catch (error) {
    logger.warn(MODULE_NAME, '读取旧 mock 数据中的设置失败', error);
    return null;
  }
}

// 为了在首次运行或文件损坏时恢复可用的设置数据。
function rebuildSettingsFile(reason: string, error?: unknown): Settings {
  if (error) {
    logger.warn(MODULE_NAME, reason, error);
  } else {
    logger.info(MODULE_NAME, reason);
  }

  const recoveredSettings = tryReadLegacySettings() ?? { ...DEFAULT_SETTINGS };
  return writeSettingsFile(recoveredSettings);
}

// 为了同步开机自启设置对应的系统副作用。
function syncLaunchOnStartup(settings: Settings): void {
  if (process.platform !== 'win32') {
    logger.info(MODULE_NAME, '当前系统不是 Windows，跳过开机自启同步');
    return;
  }

  if (!app.isReady()) {
    logger.warn(MODULE_NAME, '应用尚未就绪，跳过本次开机自启同步');
    return;
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: settings.launchOnStartup,
      path: process.execPath,
    });
    logger.info(MODULE_NAME, `已同步开机自启设置：${settings.launchOnStartup}`);
  } catch (error) {
    logger.warn(MODULE_NAME, '同步开机自启设置失败', error);
  }
}

// 为了读取当前项目的唯一设置持久化数据源。
export function readSettingsFromService(): Settings {
  const settingsFilePath = getSettingsFilePath();
  if (!existsSync(settingsFilePath)) {
    return rebuildSettingsFile(`未找到设置数据文件，已重建：${settingsFilePath}`);
  }

  try {
    const content = readFileSync(settingsFilePath, 'utf8');
    const parsed = JSON.parse(content);
    const settings = sanitizeSettings(parsed);
    if (!settings) {
      return rebuildSettingsFile('设置数据文件结构无效，已重建');
    }

    return settings;
  } catch (error) {
    return rebuildSettingsFile('读取设置数据文件失败，已重建', error);
  }
}

// 为了把新的设置保存到唯一持久化来源中并同步系统副作用。
export function writeSettingsToService(settings: Settings): Settings {
  const persistedSettings = writeSettingsFile(settings);
  syncLaunchOnStartup(persistedSettings);
  return persistedSettings;
}

// 为了向 IPC 层提供异步的设置读取能力。
export async function getSettings(): Promise<Settings> {
  return readSettingsFromService();
}

// 为了向 IPC 层提供异步的设置保存能力。
export async function saveSettings(settings: Settings): Promise<Settings> {
  return writeSettingsToService(settings);
}

// 为了给主进程窗口关闭逻辑提供后台运行策略。
export async function shouldHideWindowOnClose(): Promise<boolean> {
  return readSettingsFromService().runInBackground;
}

// 为了给后续 killer 提供管理员模式策略依据。
export async function isAdminModeEnabled(): Promise<boolean> {
  return readSettingsFromService().adminMode;
}
