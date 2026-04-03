import { ipcMain } from 'electron';

import type { Settings } from '../../src/types';
import { getSettings, saveSettings } from '../modules/settingsService';

// 为了把 settingsService 的读写能力注册到主进程 IPC。
export function registerSettingsIpc(options?: {
  onSettingsSaved?: (settings: Settings) => Promise<void> | void;
}): void {
  ipcMain.handle('settings:get', async () => getSettings());
  ipcMain.handle('settings:save', async (_event, settings) => {
    const savedSettings = await saveSettings(settings);
    await options?.onSettingsSaved?.(savedSettings);
    return savedSettings;
  });
}
