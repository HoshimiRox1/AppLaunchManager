const path = require('node:path');

const { patchExecutableIcon } = require('./windows-icon-patcher.cjs');

// 为了在 electron-builder 完成打包目录后修复产物 exe 的图标资源。
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const executableName = `${context.packager.appInfo.productFilename}.exe`;
  const executablePath = path.join(context.appOutDir, executableName);
  patchExecutableIcon(executablePath);
};
