import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { AppEntry, Preset } from '../src/types';
import { logger } from './logger';
import { getRuntimePaths } from './runtimePaths';

const MODULE_NAME = 'presetStore.ts';
const PRESET_FILE_NAME = 'presets.json';
const LEGACY_MOCK_FILE_NAME = 'launch-manager-mock.json';

const DEFAULT_PRESET_APPS: AppEntry[] = [
  {
    id: 'app-qq',
    name: 'QQ',
    exePath: 'C:\\Program Files\\Tencent\\QQ\\QQ.exe',
    installDir: 'C:\\Program Files\\Tencent\\QQ',
    iconPath: '',
    customProcessNames: ['qq.exe'],
  },
  {
    id: 'app-wechat',
    name: '微信',
    exePath: 'C:\\Program Files\\Tencent\\WeChat\\WeChat.exe',
    installDir: 'C:\\Program Files\\Tencent\\WeChat',
    iconPath: '',
    customProcessNames: ['wechat.exe'],
  },
  {
    id: 'app-chrome',
    name: 'Chrome',
    exePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    installDir: 'C:\\Program Files\\Google\\Chrome\\Application',
    iconPath: '',
    customProcessNames: ['chrome.exe'],
  },
  {
    id: 'app-notion',
    name: 'Notion',
    exePath: 'C:\\Users\\Public\\AppData\\Local\\Programs\\Notion\\Notion.exe',
    installDir: 'C:\\Users\\Public\\AppData\\Local\\Programs\\Notion',
    iconPath: '',
    customProcessNames: ['notion.exe'],
  },
  {
    id: 'app-spotify',
    name: 'Spotify',
    exePath: 'C:\\Users\\Public\\AppData\\Roaming\\Spotify\\Spotify.exe',
    installDir: 'C:\\Users\\Public\\AppData\\Roaming\\Spotify',
    iconPath: '',
    customProcessNames: ['spotify.exe'],
  },
  {
    id: 'app-word',
    name: 'Word',
    exePath: 'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
    installDir: 'C:\\Program Files\\Microsoft Office\\root\\Office16',
    iconPath: '',
    customProcessNames: ['winword.exe'],
  },
  {
    id: 'app-code',
    name: 'VS Code',
    exePath: 'C:\\Users\\Public\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
    installDir: 'C:\\Users\\Public\\AppData\\Local\\Programs\\Microsoft VS Code',
    iconPath: '',
    customProcessNames: ['code.exe'],
  },
];

interface LegacyMockDatabase {
  presets?: unknown;
}

// 为了获取 presetStore 的独立数据文件路径。
function getPresetFilePath(): string {
  const dataDir = getRuntimePaths().dataDir;
  mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, PRESET_FILE_NAME);
}

// 为了定位旧版 mock 数据文件并执行一次性迁移。
function getLegacyMockFilePath(): string {
  const dataDir = getRuntimePaths().dataDir;
  mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, LEGACY_MOCK_FILE_NAME);
}

// 为了在读写时隔离内部对象引用。
function cloneAppEntry(appEntry: AppEntry): AppEntry {
  return {
    ...appEntry,
    customProcessNames: appEntry.customProcessNames.slice(),
  };
}

// 为了在读写时隔离内部对象引用。
function clonePreset(preset: Preset): Preset {
  return {
    ...preset,
    apps: preset.apps.map((appEntry) => cloneAppEntry(appEntry)),
  };
}

// 为了生成与当前 UI 一致的默认预设数据。
function createDefaultPresets(): Preset[] {
  const appMap = new Map(DEFAULT_PRESET_APPS.map((appEntry) => [appEntry.id, appEntry]));

  return [
    {
      id: 'preset-work',
      name: '办公模式',
      order: 0,
      apps: ['app-qq', 'app-wechat', 'app-chrome', 'app-notion'].map((appId) => cloneAppEntry(appMap.get(appId)!)),
    },
    {
      id: 'preset-focus',
      name: '专注开发',
      order: 1,
      apps: ['app-code', 'app-word', 'app-spotify'].map((appId) => cloneAppEntry(appMap.get(appId)!)),
    },
  ];
}

// 为了校验并清洗应用条目的落盘结构。
function sanitizeAppEntry(value: unknown): AppEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<AppEntry>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.exePath !== 'string' ||
    typeof candidate.installDir !== 'string' ||
    typeof candidate.iconPath !== 'string' ||
    !Array.isArray(candidate.customProcessNames) ||
    candidate.customProcessNames.some((processName) => typeof processName !== 'string')
  ) {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    exePath: candidate.exePath,
    installDir: candidate.installDir,
    iconPath: candidate.iconPath,
    customProcessNames: candidate.customProcessNames.slice(),
  };
}

// 为了校验并清洗单个预设的落盘结构。
function sanitizePreset(value: unknown, index: number): Preset | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<Preset>;
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !Array.isArray(candidate.apps)) {
    return null;
  }

  const apps = candidate.apps
    .map((appEntry) => sanitizeAppEntry(appEntry))
    .filter((appEntry): appEntry is AppEntry => Boolean(appEntry));

  return {
    id: candidate.id,
    name: candidate.name,
    order: index,
    apps,
  };
}

// 为了把任意来源的预设数组归一化成稳定顺序。
function normalizePresets(value: unknown): Preset[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((preset, index) => sanitizePreset(preset, index))
    .filter((preset): preset is Preset => Boolean(preset));
}

// 为了把预设集合转换成可安全复用的持久化快照。
function createPersistedPresets(presets: Preset[]): Preset[] {
  return presets.map((preset, index) => ({
    ...clonePreset(preset),
    order: index,
  }));
}

// 为了把预设文件稳定写入到独立存储中。
function writePresetFile(presets: Preset[]): Preset[] {
  const persistedPresets = createPersistedPresets(presets);
  writeFileSync(getPresetFilePath(), JSON.stringify(persistedPresets, null, 2), 'utf8');
  logger.info(MODULE_NAME, `写入预设数据文件，数量：${persistedPresets.length}`);
  return persistedPresets;
}

// 为了从旧版 mock 数据文件中提取可迁移的预设数据。
function tryReadLegacyPresets(): Preset[] | null {
  const legacyFilePath = getLegacyMockFilePath();
  if (!existsSync(legacyFilePath)) {
    return null;
  }

  try {
    const content = readFileSync(legacyFilePath, 'utf8');
    const parsed = JSON.parse(content) as LegacyMockDatabase;
    const legacyPresets = normalizePresets(parsed.presets);
    if (!legacyPresets) {
      return null;
    }

    logger.info(MODULE_NAME, `从旧 mock 数据迁移预设成功：${legacyFilePath}`);
    return createPersistedPresets(legacyPresets);
  } catch (error) {
    logger.warn(MODULE_NAME, '读取旧 mock 数据中的预设失败', error);
    return null;
  }
}

// 为了在首次运行或文件损坏时恢复可用的预设数据。
function rebuildPresetFile(reason: string, error?: unknown): Preset[] {
  if (error) {
    logger.warn(MODULE_NAME, reason, error);
  } else {
    logger.info(MODULE_NAME, reason);
  }

  const recoveredPresets = tryReadLegacyPresets() ?? createDefaultPresets();
  return writePresetFile(recoveredPresets);
}

// 为了读取当前项目的唯一 preset 持久化数据源。
export function readPresetsFromStore(): Preset[] {
  const presetFilePath = getPresetFilePath();
  if (!existsSync(presetFilePath)) {
    return rebuildPresetFile(`未找到预设数据文件，已重建：${presetFilePath}`);
  }

  try {
    const content = readFileSync(presetFilePath, 'utf8');
    const parsed = JSON.parse(content);
    const presets = normalizePresets(parsed);
    if (!presets) {
      return rebuildPresetFile('预设数据文件结构无效，已重建');
    }

    return createPersistedPresets(presets);
  } catch (error) {
    return rebuildPresetFile('读取预设数据文件失败，已重建', error);
  }
}

// 为了把新的预设列表保存到唯一持久化来源中。
export function writePresetsToStore(presets: Preset[]): Preset[] {
  return writePresetFile(presets);
}

// 为了向 IPC 层提供异步的预设读取能力。
export async function getPresets(): Promise<Preset[]> {
  return readPresetsFromStore();
}

// 为了向 IPC 层提供异步的预设保存能力。
export async function savePresets(presets: Preset[]): Promise<void> {
  writePresetsToStore(presets);
}
