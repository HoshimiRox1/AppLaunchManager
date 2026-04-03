import type { AppStatus, Preset, ScannedApp, Settings } from '../../src/types';
import { scanInstalledApps } from '../modules/appScanner';
import { startPreset } from '../modules/appLauncher';
import { confirmStop, stopPreset } from '../modules/appKiller';
import { getStatuses, subscribeToStatuses } from '../modules/appMonitor';
import { readPresetsFromStore, savePresets as savePresetsToStore } from '../modules/presetStore';
import { getSettings as getSettingsFromService, saveSettings as saveSettingsToService } from '../modules/settingsService';

export { confirmStop, getStatuses, startPreset, stopPreset, subscribeToStatuses };

// 为了让旧的 mockBackend 入口继续复用当前真实模块实现。
export async function getPresets(): Promise<Preset[]> {
  return readPresetsFromStore()
    .slice()
    .sort((left, right) => left.order - right.order);
}

// 为了让旧的 mockBackend 入口继续复用当前真实预设存储实现。
export async function savePresets(presets: Preset[]): Promise<void> {
  await savePresetsToStore(presets);
}

// 为了让旧的 mockBackend 入口继续复用当前真实设置实现。
export async function getSettings(): Promise<Settings> {
  return getSettingsFromService();
}

// 为了让旧的 mockBackend 入口继续复用当前真实设置实现。
export async function saveSettings(settings: Settings): Promise<Settings> {
  return saveSettingsToService(settings);
}

// 为了让旧的 mockBackend 入口继续复用当前真实扫描实现。
export async function scanInstalledAppsFromMockBackend(): Promise<ScannedApp[]> {
  return scanInstalledApps();
}

// 为了兼容旧命名导出并继续返回 app 级状态结构。
export async function getAppStatuses(): Promise<AppStatus[]> {
  return getStatuses();
}
