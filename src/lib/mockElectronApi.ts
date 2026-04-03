import type { AppStatus, ElectronAPI, Preset, ScannedApp, Settings } from '../types';
import { normalizePresetOrders, pathBaseName, toAppEntry } from './utils';

interface MockState {
  presets: Preset[];
  settings: Settings;
  runningAppIds: string[];
}

const STORAGE_KEY = 'launch-manager-ui-prototype';
const listeners = new Set<(statuses: AppStatus[]) => void>();
const HIGH_RISK_PROCESS_NAMES = new Set([
  'winword.exe',
  'excel.exe',
  'powerpnt.exe',
  'notepad++.exe',
  'sublime_text.exe',
  'code.exe',
]);

const scannedApps: ScannedApp[] = [
  {
    name: 'QQ',
    exePath: 'C:\\Program Files\\Tencent\\QQ\\QQ.exe',
    installDir: 'C:\\Program Files\\Tencent\\QQ',
    iconPath: '',
  },
  {
    name: '微信',
    exePath: 'C:\\Program Files\\Tencent\\WeChat\\WeChat.exe',
    installDir: 'C:\\Program Files\\Tencent\\WeChat',
    iconPath: '',
  },
  {
    name: 'Chrome',
    exePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    installDir: 'C:\\Program Files\\Google\\Chrome\\Application',
    iconPath: '',
  },
  {
    name: 'Notion',
    exePath: 'C:\\Users\\Public\\AppData\\Local\\Programs\\Notion\\Notion.exe',
    installDir: 'C:\\Users\\Public\\AppData\\Local\\Programs\\Notion',
    iconPath: '',
  },
  {
    name: 'Spotify',
    exePath: 'C:\\Users\\Public\\AppData\\Roaming\\Spotify\\Spotify.exe',
    installDir: 'C:\\Users\\Public\\AppData\\Roaming\\Spotify',
    iconPath: '',
  },
  {
    name: 'Steam',
    exePath: 'C:\\Program Files (x86)\\Steam\\steam.exe',
    installDir: 'C:\\Program Files (x86)\\Steam',
    iconPath: '',
  },
  {
    name: 'Discord',
    exePath: 'C:\\Users\\Public\\AppData\\Local\\Discord\\Update.exe',
    installDir: 'C:\\Users\\Public\\AppData\\Local\\Discord',
    iconPath: '',
  },
  {
    name: 'Word',
    exePath: 'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
    installDir: 'C:\\Program Files\\Microsoft Office\\root\\Office16',
    iconPath: '',
  },
  {
    name: 'VS Code',
    exePath: 'C:\\Users\\Public\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
    installDir: 'C:\\Users\\Public\\AppData\\Local\\Programs\\Microsoft VS Code',
    iconPath: '',
  },
];

// 为了在浏览器兜底环境里推导默认监测目录。
function getDefaultInstallDir(filePath: string): string {
  const normalized = filePath.trim().replace(/\//g, '\\');
  if (!normalized) {
    return '';
  }

  const segments = normalized.split('\\').filter(Boolean);
  if (segments.length <= 1) {
    return normalized;
  }

  segments.pop();
  if (/^[a-zA-Z]:$/u.test(segments[0])) {
    return `${segments[0]}\\${segments.slice(1).join('\\')}`.replace(/[\\/]+$/u, '') || `${segments[0]}\\`;
  }

  return segments.join('\\');
}

// 为了在浏览器兜底环境里把监测目录回退到上一级。
function getParentInstallDir(directoryPath: string): string {
  const normalized = directoryPath.trim().replace(/[\\/]+$/u, '');
  if (!normalized) {
    return '';
  }

  const segments = normalized.split('\\').filter(Boolean);
  if (segments.length <= 1) {
    return normalized;
  }

  segments.pop();
  if (/^[a-zA-Z]:$/u.test(segments[0])) {
    return `${segments[0]}\\${segments.slice(1).join('\\')}`.replace(/[\\/]+$/u, '') || `${segments[0]}\\`;
  }

  return segments.join('\\');
}

// 为了在浏览器兜底环境里生成 app 级状态列表。
function buildAppStatuses(state: MockState): AppStatus[] {
  const seenAppIds = new Set<string>();

  return state.presets.flatMap((preset) =>
    preset.apps.flatMap((appEntry) => {
      if (seenAppIds.has(appEntry.id)) {
        return [];
      }

      seenAppIds.add(appEntry.id);
      return [
        {
          appId: appEntry.id,
          isRunning: state.runningAppIds.includes(appEntry.id),
        },
      ];
    }),
  );
}

// 为了在浏览器兜底环境里查找命中的高风险应用。
function inferRiskyApps(state: MockState, presetId: string): string[] {
  const preset = state.presets.find((item) => item.id === presetId);
  if (!preset) {
    return [];
  }

  const runningIds = new Set(state.runningAppIds);
  return preset.apps
    .filter((appEntry) => runningIds.has(appEntry.id))
    .filter((appEntry) => HIGH_RISK_PROCESS_NAMES.has(`${pathBaseName(appEntry.exePath).toLowerCase()}.exe`))
    .map((appEntry) => appEntry.name);
}

function defaultState(): MockState {
  const apps = scannedApps.map((app) => toAppEntry(app));
  const byName = new Map(apps.map((app) => [app.name, app]));

  return {
    presets: [
      {
        id: 'preset-work',
        name: '办公模式',
        order: 0,
        apps: ['QQ', '微信', 'Chrome', 'Notion'].map((name) => ({ ...byName.get(name)! })),
      },
      {
        id: 'preset-focus',
        name: '专注开发',
        order: 1,
        apps: ['VS Code', 'Word', 'Spotify'].map((name) => ({ ...byName.get(name)! })),
      },
    ],
    settings: {
      adminMode: false,
      runInBackground: true,
      launchOnStartup: false,
    },
    runningAppIds: apps.filter((app) => ['QQ', '微信', 'Chrome', 'Word'].includes(app.name)).map((app) => app.id),
  };
}

function readState(): MockState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const nextState = defaultState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return nextState;
  }

  try {
    return JSON.parse(raw) as MockState;
  } catch {
    const nextState = defaultState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return nextState;
  }
}

function writeState(state: MockState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emitStatuses(state = readState()): void {
  const statuses = buildAppStatuses(state);
  listeners.forEach((listener) => listener(statuses));
}

function updateState(updater: (current: MockState) => MockState): MockState {
  const nextState = updater(readState());
  writeState(nextState);
  emitStatuses(nextState);
  return nextState;
}

export function installMockElectronApi(): void {
  if (window.electronAPI) {
    return;
  }

  const api: ElectronAPI = {
    presetGetAll: async () => normalizePresetOrders(readState().presets),
    presetSave: async (presets) => {
      updateState((current) => ({
        ...current,
        presets: normalizePresetOrders(presets),
      }));
    },
    launcherStartPreset: async (presetId) => {
      updateState((current) => {
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
    },
    killerStopPreset: async (presetId) => {
      const current = readState();
      const riskyApps = inferRiskyApps(current, presetId);
      if (riskyApps.length > 0) {
        return { needsConfirm: true, riskyApps };
      }

      updateState((state) => {
        const preset = state.presets.find((item) => item.id === presetId);
        if (!preset) {
          return state;
        }

        const appIds = new Set(preset.apps.map((appEntry) => appEntry.id));
        return {
          ...state,
          runningAppIds: state.runningAppIds.filter((appId) => !appIds.has(appId)),
        };
      });

      return { needsConfirm: false, riskyApps: [] };
    },
    killerConfirmStop: async (presetId) => {
      updateState((state) => {
        const preset = state.presets.find((item) => item.id === presetId);
        if (!preset) {
          return state;
        }

        const appIds = new Set(preset.apps.map((appEntry) => appEntry.id));
        return {
          ...state,
          runningAppIds: state.runningAppIds.filter((appId) => !appIds.has(appId)),
        };
      });
    },
    settingsGet: async () => readState().settings,
    settingsSave: async (settings) => {
      updateState((current) => ({
        ...current,
        settings,
      }));
      return settings;
    },
    appScanInstalled: async () => scannedApps,
    pathGetDefaultInstallDir: async (filePath) => getDefaultInstallDir(filePath),
    pathGetParentDir: async (directoryPath) => getParentInstallDir(directoryPath),
    getCurrentStatuses: async () => buildAppStatuses(readState()),
    onStatusUpdate: (callback) => {
      listeners.add(callback);
      callback(buildAppStatuses(readState()));
      return () => listeners.delete(callback);
    },
  };

  window.electronAPI = api;
}
