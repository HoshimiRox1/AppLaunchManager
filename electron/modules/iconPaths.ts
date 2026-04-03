import { app } from 'electron';
import path from 'node:path';

const ICON_FILE_NAME = 'Feibi.ico';
const ICON_RELATIVE_PATH = path.join('assets', 'icons', ICON_FILE_NAME);
const PACKAGED_APP_ID = 'com.launchmanager.app';
const DEV_APP_ID = 'com.launchmanager.app.dev';

// 为了统一解析开发态和打包态都可用的应用图标路径。
export function getAppIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ICON_RELATIVE_PATH);
  }

  return path.resolve(process.cwd(), ICON_RELATIVE_PATH);
}

// 为了区分开发态和发布态在 Windows 任务栏中的应用身份。
export function getAppId(): string {
  return app.isPackaged ? PACKAGED_APP_ID : DEV_APP_ID;
}
