import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { AppEntry, Preset, PresetStatus, RunStatus, ScannedApp, Settings } from '../src/types';

interface MockDatabase {
  presets: Preset[];
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
    presets: [
      {
        id: 'preset-work',
        name: '办公模式',
        order: 0,
        apps: installedApps
          .filter((appEntry) => ['app-qq', 'app-wechat', 'app-chrome', 'app-notion'].includes(appEntry.id))
          .map((appEntry) => ({ ...appEntry })),
      },
      {
        id: 'preset-focus',
        name: '专注开发',
        order: 1,
        apps: installedApps
          .filter((appEntry) => ['app-code', 'app-word', 'app-spotify'].includes(appEntry.id))
          .map((appEntry) => ({ ...appEntry })),
      },
    ],
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
    const userDataDir = app.getPath('userData');
    mkdirSync(userDataDir, { recursive: true });
    dbFilePath = path.join(userDataDir, 'launch-manager-mock.json');
  }

  if (!existsSync(dbFilePath)) {
    const initialState = defaultState();
    writeFileSync(dbFilePath, JSON.stringify(initialState, null, 2), 'utf8');
    return initialState;
  }

  try {
    const content = readFileSync(dbFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<MockDatabase>;
    const fallback = defaultState();
    return {
      presets: parsed.presets ?? fallback.presets,
      settings: parsed.settings ?? fallback.settings,
      runningAppIds: parsed.runningAppIds ?? fallback.runningAppIds,
    };
  } catch {
    const fallback = defaultState();
    writeFileSync(dbFilePath, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function writeDatabase(db: MockDatabase): void {
  writeFileSync(dbFilePath, JSON.stringify(db, null, 2), 'utf8');
}

function getDatabase(): MockDatabase {
  return readDatabase();
}

function buildStatuses(db: MockDatabase): PresetStatus[] {
  const runningIds = new Set(db.runningAppIds);

  return db.presets
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
  return getDatabase()
    .presets.slice()
    .sort((left, right) => left.order - right.order);
}

export async function savePresets(presets: Preset[]): Promise<void> {
  updateDatabase((current) => {
    const validAppIds = new Set(presets.flatMap((preset) => preset.apps.map((appEntry) => appEntry.id)));
    return {
      ...current,
      presets,
      runningAppIds: current.runningAppIds.filter((appId) => validAppIds.has(appId)),
    };
  });
}

export async function startPreset(presetId: string): Promise<void> {
  updateDatabase((current) => {
    const preset = current.presets.find((item) => item.id === presetId);
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
  const current = getDatabase();
  const preset = current.presets.find((item) => item.id === presetId);

  if (!preset) {
    return {
      needsConfirm: false,
      riskyApps: [],
    };
  }

  const runningIds = new Set(current.runningAppIds);
  const riskyApps = inferRiskyApps(preset, runningIds);

  if (riskyApps.length > 0) {
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
  updateDatabase((current) => {
    const preset = current.presets.find((item) => item.id === presetId);
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
  updateDatabase((current) => ({
    ...current,
    settings,
  }));
  return settings;
}

export async function scanInstalledApps(): Promise<ScannedApp[]> {
  return installedApps.map(({ name, exePath, installDir, iconPath, customProcessNames }) => ({
    name,
    exePath,
    installDir,
    iconPath,
    customProcessNames,
  }));
}


