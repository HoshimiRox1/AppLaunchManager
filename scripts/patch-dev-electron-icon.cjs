const path = require('node:path');

const { patchExecutableIcon } = require('./windows-icon-patcher.cjs');

// 为了在开发模式启动前修复本地 Electron 二进制的任务栏图标。
function main() {
  if (process.platform !== 'win32') {
    return;
  }

  const electronExePath = path.resolve(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
  patchExecutableIcon(electronExePath);
}

main();
