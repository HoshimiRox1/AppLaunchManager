export interface AppEntry {
  id: string;
  name: string;
  exePath: string;
  installDir: string;
  iconPath: string;
  customProcessNames: string[];
}

export interface Preset {
  id: string;
  name: string;
  order: number;
  apps: AppEntry[];
}

export interface Settings {
  adminMode: boolean;
  runInBackground: boolean;
  launchOnStartup: boolean;
}

export type RunStatus = 'stopped' | 'partial' | 'running';

export interface PresetStatus {
  presetId: string;
  runningCount: number;
  totalCount: number;
  status: RunStatus;
}

export interface ScannedApp {
  name: string;
  exePath: string;
  installDir: string;
  iconPath: string;
  customProcessNames: string[];
}

export interface StopPresetResponse {
  needsConfirm: boolean;
  riskyApps: string[];
}

export interface ElectronAPI {
  presetGetAll: () => Promise<Preset[]>;
  presetSave: (presets: Preset[]) => Promise<void>;
  launcherStartPreset: (presetId: string) => Promise<void>;
  killerStopPreset: (presetId: string) => Promise<StopPresetResponse>;
  killerConfirmStop: (presetId: string) => Promise<void>;
  settingsGet: () => Promise<Settings>;
  settingsSave: (settings: Settings) => Promise<Settings>;
  appScanInstalled: () => Promise<ScannedApp[]>;
  getCurrentStatuses: () => Promise<PresetStatus[]>;
  onStatusUpdate: (callback: (statuses: PresetStatus[]) => void) => () => void;
}
