import { ipcMain } from 'electron';

import { scanInstalledApps } from '../modules/appScanner';

// 为了把 appScanner 的扫描能力注册到主进程 IPC。
export function registerScannerIpc(): void {
  ipcMain.handle('app:scanInstalled', async () => scanInstalledApps());
}
