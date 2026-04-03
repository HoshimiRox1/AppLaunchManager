import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { AppEntry, Preset, PresetStatus, RunStatus, ScannedApp, Settings } from '../src/types';
import { logger } from './logger';
import { readPresetsFromStore, savePresets as savePresetsToStore } from './presetStore';
import { getRuntimePaths } from './runtimePaths';

interface MockDatabase {
  settings: Settings;
  runningAppIds: string[];
}

const HIGH_RISK_PROCESSES = new Set([
  'winword.exe',
  'excel.exe',
  'powerpnt.exe',
  'notepad++.exe',
  'sublime_text.exe',
  'code.exe',
]);

const listeners = new Set<(statuses: PresetStatus[]) => void>();
let dbFilePath = '';
const MODULE_NAME = 'mockBackend.ts';

const installedApps: AppEntry[] = [
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
    id: 'app-steam',
    name: 'Steam',
    exePath: 'C:\\Program Files (x86)\\Steam\\steam.exe',
    installDir: 'C:\\Program Files (x86)\\Steam',
    iconPath: '',
    customProcessNames: ['steam.exe'],
  },
  {
    id: 'app-discord',
    name: 'Discord',
    exePath: 'C:\\Users\\Public\\AppData\\Local\\Discord\\Update.exe',
    installDir: 'C:\\Users\\Public\\AppData\\Local\\Discord',
    iconPath: '',
    customProcessNames: ['discord.exe'],
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

function defaultState(): MockDatabase {
  return {
    settings: {
      adminMode: false,
      runInBackground: true,
      launchOnStartup: false,
    },
    runningAppIds: ['app-qq', 'app-wechat', 'app-chrome', 'app-word'],
  };
}

function readDatabase(): MockDatabase {
  if (!dbFilePath) {
    const dataDir = getRuntimePaths().dataDir;
    mkdirSync(dataDir, { recursive: true });
    dbFilePath = path.join(dataDir, 'launch-manager-mock.json');
    logger.info(MODULE_NAME, `初始化数据文件路径：${dbFilePath}`);
  }

  if (!existsSync(dbFilePath)) {
    const initialState = defaultState();
    writeFileSync(dbFilePath, JSON.stringify(initialState, null, 2), 'utf8');
    logger.info(MODULE_NAME, '创建默认 mock 数据文件');
    return initialState;
  }

  try {
    const content = readFileSync(dbFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<MockDatabase>;
    const fallback = defaultState();
    return {
      settings: parsed.settings ?? fallback.settings,
      runningAppIds: parsed.runningAppIds ?? fallback.runningAppIds,
    };
  } catch (error) {
    const fallback = defaultState();
    writeFileSync(dbFilePath, JSON.stringify(fallback, null, 2), 'utf8');
    logger.warn(MODULE_NAME, '读取 mock 数据失败，已回退到默认数据', error);
    return fallback;
  }
}

function writeDatabase(db: MockDatabase): void {
  writeFileSync(dbFilePath, JSON.stringify(db, null, 2), 'utf8');
  logger.info(MODULE_NAME, '写入 mock 数据文件');
}

function getDatabase(): MockDatabase {
  return readDatabase();
}

// 为了基于 presetStore 和当前运行态生成状态摘要。
function buildStatuses(db: MockDatabase): PresetStatus[] {
  const runningIds = new Set(db.runningAppIds);
  const presets = readPresetsFromStore();

  return presets
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((preset) => {
      const runningCount = preset.apps.filter((appEntry) => runningIds.has(appEntry.id)).length;
      const totalCount = preset.apps.length;
      let status: RunStatus = 'stopped';

      if (runningCount > 0 && runningCount < totalCount) {
        status = 'partial';
      } else if (totalCount > 0 && runningCount === totalCount) {
        status = 'running';
      }

      return {
        presetId: preset.id,
        runningCount,
        totalCount,
        status,
      };
    });
}

function emitStatuses(db = getDatabase()): void {
  const statuses = buildStatuses(db);
  listeners.forEach((listener) => listener(statuses));
}

function updateDatabase(updater: (current: MockDatabase) => MockDatabase): MockDatabase {
  const next = updater(getDatabase());
  writeDatabase(next);
  emitStatuses(next);
  return next;
}

function inferRiskyApps(preset: Preset, runningIds: Set<string>): string[] {
  return preset.apps
    .filter((appEntry) => runningIds.has(appEntry.id))
    .filter((appEntry) =>
      appEntry.customProcessNames.some((processName) => HIGH_RISK_PROCESSES.has(processName.toLowerCase())),
    )
    .map((appEntry) => appEntry.name);
}

export function subscribeToStatuses(listener: (statuses: PresetStatus[]) => void): () => void {
  listeners.add(listener);
  listener(buildStatuses(getDatabase()));
  return () => listeners.delete(listener);
}

export async function getStatuses(): Promise<PresetStatus[]> {
  return buildStatuses(getDatabase());
}

export async function getPresets(): Promise<Preset[]> {
  return readPresetsFromStore()
    .slice()
    .sort((left, right) => left.order - right.order);
}

export async function savePresets(presets: Preset[]): Promise<void> {
  logger.info(MODULE_NAME, `保存预设列表，数量：${presets.length}`);
  await savePresetsToStore(presets);

  const savedPresets = readPresetsFromStore();
  updateDatabase((current) => {
    const validAppIds = new Set(savedPresets.flatMap((preset) => preset.apps.map((appEntry) => appEntry.id)));
    return {
      ...current,
      runningAppIds: current.runningAppIds.filter((appId) => validAppIds.has(appId)),
    };
  });
}

export async function startPreset(presetId: string): Promise<void> {
  logger.info(MODULE_NAME, `启动预设：${presetId}`);
  updateDatabase((current) => {
    const preset = readPresetsFromStore().find((item) => item.id === presetId);
    if (!preset) {
      return current;
    }

    const runningAppIds = new Set(current.runningAppIds);
    preset.apps.forEach((appEntry) => runningAppIds.add(appEntry.id));

    return {
      ...current,
      runningAppIds: Array.from(runningAppIds),
    };
  });
}

export async function stopPreset(
  presetId: string,
): Promise<{ needsConfirm: boolean; riskyApps: string[] }> {
  logger.info(MODULE_NAME, `尝试关闭预设：${presetId}`);
  const current = getDatabase();
  const preset = readPresetsFromStore().find((item) => item.id === presetId);

  if (!preset) {
    return {
      needsConfirm: false,
      riskyApps: [],
    };
  }

  const runningIds = new Set(current.runningAppIds);
  const riskyApps = inferRiskyApps(preset, runningIds);

  if (riskyApps.length > 0) {
    logger.warn(MODULE_NAME, `预设存在高风险应用，等待确认：${riskyApps.join(', ')}`);
    return {
      needsConfirm: true,
      riskyApps,
    };
  }

  await confirmStop(presetId);
  return {
    needsConfirm: false,
    riskyApps: [],
  };
}

export async function confirmStop(presetId: string): Promise<void> {
  logger.info(MODULE_NAME, `确认关闭预设：${presetId}`);
  updateDatabase((current) => {
    const preset = readPresetsFromStore().find((item) => item.id === presetId);
    if (!preset) {
      return current;
    }

    const presetAppIds = new Set(preset.apps.map((appEntry) => appEntry.id));
    return {
      ...current,
      runningAppIds: current.runningAppIds.filter((appId) => !presetAppIds.has(appId)),
    };
  });
}

export async function getSettings(): Promise<Settings> {
  return getDatabase().settings;
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  logger.info(MODULE_NAME, '保存设置项');
  updateDatabase((current) => ({
    ...current,
    settings,
  }));
  return settings;
}

export async function scanInstalledApps(): Promise<ScannedApp[]> {
  logger.info(MODULE_NAME, `扫描 mock 应用列表，数量：${installedApps.length}`);
  return installedApps.map(({ name, exePath, installDir, iconPath, customProcessNames }) => ({
    name,
    exePath,
    installDir,
    iconPath,
    customProcessNames,
  }));
}
