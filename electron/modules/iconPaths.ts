import { app } from 'electron';
import path from 'node:path';

const ICON_FILE_NAME = 'Feibi.ico';
const ICON_RELATIVE_PATH = path.join('assets', 'icons', ICON_FILE_NAME);
export const APP_ID = 'com.launchmanager.app';

// 为了统一解析开发态和打包态都可用的应用图标路径。
export function getAppIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ICON_RELATIVE_PATH);
  }

  return path.resolve(process.cwd(), ICON_RELATIVE_PATH);
}
