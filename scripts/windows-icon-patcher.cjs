const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const iconPath = path.join(projectRoot, 'assets', 'icons', 'Feibi.ico');

// 为了挑选当前机器上可用的 rcedit 可执行文件。
function resolveRceditPath() {
  const cacheRoot = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'winCodeSign')
    : '';

  if (!cacheRoot || !fs.existsSync(cacheRoot)) {
    throw new Error('未找到 electron-builder 的 winCodeSign 缓存目录');
  }

  const matchedPaths = fs
    .readdirSync(cacheRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(cacheRoot, entry.name, 'rcedit-x64.exe'))
    .filter((currentPath) => fs.existsSync(currentPath))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);

  if (matchedPaths.length === 0) {
    throw new Error('未找到可用的 rcedit-x64.exe');
  }

  return matchedPaths[0];
}

// 为了把指定 exe 的 Windows 图标资源替换为 Feibi.ico。
function patchExecutableIcon(executablePath) {
  if (process.platform !== 'win32') {
    console.log(`[icon-patch] 非 Windows 环境，跳过：${executablePath}`);
    return;
  }

  if (!fs.existsSync(executablePath)) {
    throw new Error(`目标 exe 不存在：${executablePath}`);
  }

  if (!fs.existsSync(iconPath)) {
    throw new Error(`图标文件不存在：${iconPath}`);
  }

  const rceditPath = resolveRceditPath();
  const result = spawnSync(rceditPath, [executablePath, '--set-icon', iconPath], {
    stdio: 'inherit',
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error(`rcedit 执行失败，退出码：${result.status ?? 'unknown'}`);
  }

  console.log(`[icon-patch] 已写入图标：${executablePath}`);
}

module.exports = {
  patchExecutableIcon,
};
