import { ipcMain } from 'electron';

import { getDefaultInstallDir, getParentInstallDir } from '../modules/pathResolver';

// 为了把 installDir 相关的路径推导能力注册到主进程 IPC。
export function registerPathIpc(): void {
  ipcMain.handle('path:getDefaultInstallDir', async (_event, filePath: string) => getDefaultInstallDir(filePath));
  ipcMain.handle('path:getParentDir', async (_event, directoryPath: string) => getParentInstallDir(directoryPath));
}
