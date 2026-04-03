import path from 'node:path';

// 为了统一规范化 Windows 路径输入。
function normalizeWindowsPath(value: string): string {
  const cleaned = value.trim().replace(/\//g, '\\');
  if (!cleaned) {
    return '';
  }

  return path.win32.normalize(cleaned);
}

// 为了在目录路径是盘符根目录时保留末尾反斜杠。
function normalizeDirectoryPath(value: string): string {
  const normalized = normalizeWindowsPath(value);
  if (!normalized) {
    return '';
  }

  if (/^[a-zA-Z]:\\?$/u.test(normalized)) {
    return normalized.endsWith('\\') ? normalized : `${normalized}\\`;
  }

  return normalized.replace(/[\\/]+$/u, '');
}

// 为了根据可执行文件路径推导默认监测目录。
export function getDefaultInstallDir(filePath: string): string {
  const normalizedFilePath = normalizeWindowsPath(filePath);
  if (!normalizedFilePath) {
    return '';
  }

  return normalizeDirectoryPath(path.win32.dirname(normalizedFilePath));
}

// 为了把当前监测目录安全回退到上一级目录。
export function getParentInstallDir(directoryPath: string): string {
  const normalizedDirectoryPath = normalizeDirectoryPath(directoryPath);
  if (!normalizedDirectoryPath) {
    return '';
  }

  const parentDirectoryPath = normalizeDirectoryPath(path.win32.dirname(normalizedDirectoryPath));
  if (!parentDirectoryPath) {
    return normalizedDirectoryPath;
  }

  return parentDirectoryPath;
}
