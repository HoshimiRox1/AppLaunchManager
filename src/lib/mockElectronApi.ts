import type { ElectronAPI, Preset, PresetStatus, RunStatus, ScannedApp, Settings } from '../types';
import { normalizePresetOrders, toAppEntry } from './utils';

interface MockState {
  presets: Preset[];
  settings: Settings;
  runningAppIds: string[];
}

const STORAGE_KEY = 'launch-manager-ui-prototype';
const listeners = new Set<(statuses: PresetStatus[]) => void>();

const HIGH_RISK_PROCESSES = new Set([
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
    customProcessNames: ['qq.exe'],
  },
  {
    name: '微信',
    exePath: 'C:\\Program Files\\Tencent\\WeChat\\WeChat.exe',
    installDir: 'C:\\Program Files\\Tencent\\WeChat',
    iconPath: '',
    customProcessNames: ['wechat.exe'],
  },
  {
    name: 'Chrome',
    exePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    installDir: 'C:\\Program Files\\Google\\Chrome\\Application',
    iconPath: '',
    customProcessNames: ['chrome.exe'],
  },
  {
    name: 'Notion',
    exePath: 'C:\\Users\\Public\\AppData\\Local\\Programs\\Notion\\Notion.exe',
    installDir: 'C:\\Users\\Public\\AppData\\Local\\Programs\\Notion',
    iconPath: '',
    customProcessNames: ['notion.exe'],
  },
  {
    name: 'Spotify',
    exePath: 'C:\\Users\\Public\\AppData\\Roaming\\Spotify\\Spotify.exe',
    installDir: 'C:\\Users\\Public\\AppData\\Roaming\\Spotify',
    iconPath: '',
    customProcessNames: ['spotify.exe'],
  },
  {
    name: 'Steam',
    exePath: 'C:\\Program Files (x86)\\Steam\\steam.exe',
    installDir: 'C:\\Program Files (x86)\\Steam',
    iconPath: '',
    customProcessNames: ['steam.exe'],
  },
  {
    name: 'Discord',
    exePath: 'C:\\Users\\Public\\AppData\\Local\\Discord\\Update.exe',
    installDir: 'C:\\Users\\Public\\AppData\\Local\\Discord',
    iconPath: '',
    customProcessNames: ['discord.exe'],
  },
  {
    name: 'Word',
    exePath: 'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
    installDir: 'C:\\Program Files\\Microsoft Office\\root\\Office16',
    iconPath: '',
    customProcessNames: ['winword.exe'],
  },
  {
    name: 'VS Code',
    exePath: 'C:\\Users\\Public\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
    installDir: 'C:\\Users\\Public\\AppData\\Local\\Programs\\Microsoft VS Code',
    iconPath: '',
    customProcessNames: ['code.exe'],
  },
];

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

function buildStatuses(state: MockState): PresetStatus[] {
  const runningIds = new Set(state.runningAppIds);

  return state.presets
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((preset) => {
      const runningCount = preset.apps.filter((app) => runningIds.has(app.id)).length;
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

function emitStatuses(state = readState()): void {
  const statuses = buildStatuses(state);
  listeners.forEach((listener) => listener(statuses));
}

function updateState(updater: (current: MockState) => MockState): MockState {
  const nextState = updater(readState());
  writeState(nextState);
  emitStatuses(nextState);
  return nextState;
}

function inferRiskyApps(state: MockState, presetId: string): string[] {
  const preset = state.presets.find((item) => item.id === presetId);
  if (!preset) {
    return [];
  }

  const runningIds = new Set(state.runningAppIds);
  return preset.apps
    .filter((app) => runningIds.has(app.id))
    .filter((app) => app.customProcessNames.some((name) => HIGH_RISK_PROCESSES.has(name.toLowerCase())))
    .map((app) => app.name);
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
        preset.apps.forEach((app) => runningAppIds.add(app.id));
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

        const appIds = new Set(preset.apps.map((app) => app.id));
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

        const appIds = new Set(preset.apps.map((app) => app.id));
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
    getCurrentStatuses: async () => buildStatuses(readState()),
    onStatusUpdate: (callback) => {
      listeners.add(callback);
      callback(buildStatuses(readState()));
      return () => listeners.delete(callback);
    },
  };

  window.electronAPI = api;
}
