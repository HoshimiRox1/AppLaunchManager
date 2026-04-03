import { ipcMain } from 'electron';

import { getPresets, savePresets } from '../modules/presetStore';

// 为了把 presetStore 的读写能力注册到主进程 IPC。
export function registerPresetIpc(): void {
  ipcMain.handle('preset:getAll', async () => getPresets());
  ipcMain.handle('preset:save', async (_event, presets) => savePresets(presets));
}
