import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import type { ScannedApp } from '../src/types';
import { logger } from './logger';

interface RegistryAppPathRecord {
  keyName?: string;
  defaultValue?: string;
  path?: string;
}

interface RegistryUninstallRecord {
  keyName?: string;
  displayName?: string;
  displayIcon?: string;
  installLocation?: string;
}

interface AppSource {
  exePath: string;
  appPathsPath: string;
  appPathsKeyName: string;
  uninstallName: string;
  uninstallInstallLocation: string;
}

interface PowerShellJsonResult<T> {
  ok?: boolean;
  items?: T | T[] | null;
  error?: string;
}

const execFileAsync = promisify(execFile);
const MODULE_NAME = 'appScanner.ts';
const APP_PATH_REGISTRY_PATHS = [
  'Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*',
  'Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*',
  'Registry::HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*',
];
const UNINSTALL_REGISTRY_PATHS = [
  'Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'Registry::HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
];

// 为了安全拼接 PowerShell 单引号字符串。
function escapePowerShellString(value: string): string {
  return value.replace(/'/g, "''");
}

// 为了清洗 UTF-8 文本里的空字符和 BOM 噪音。
function cleanUtf8Text(value?: string | null): string {
  if (!value) {
    return '';
  }

  return String(value).replace(/^\uFEFF/u, '').replace(/\0/g, '').trim();
}

// 为了把 PowerShell 结果里的 items 字段统一成数组结构。
function normalizeResultItems<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

// 为了格式化 PowerShell 返回的错误消息用于日志记录。
function formatPowerShellError(errorMessage: string, registryPath: string): string {
  const cleaned = cleanUtf8Text(errorMessage).replace(/\s+/g, ' ');
  return `读取注册表分支失败：${registryPath} | ${cleaned || '未知错误'}`;
}

// 为了执行 PowerShell 并按 UTF-8 JSON 结果读取注册表数据。
async function runPowerShellJson<T>(script: string, registryPath: string): Promise<T[]> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    },
  );

  const normalizedOutput = cleanUtf8Text(stdout);
  if (!normalizedOutput) {
    return [];
  }

  const parsed = JSON.parse(normalizedOutput) as PowerShellJsonResult<T> | null;
  if (!parsed) {
    return [];
  }

  if (parsed.ok === false) {
    throw new Error(formatPowerShellError(parsed.error ?? '', registryPath));
  }

  return normalizeResultItems(parsed.items);
}

// 为了生成读取 App Paths 分支的多行 PowerShell 脚本。
function buildAppPathsScript(registryPath: string): string {
  const escapedPath = escapePowerShellString(registryPath);
  return [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    "$ErrorActionPreference = 'Stop'",
    'try {',
    `  $root = '${escapedPath}'`,
    "  $basePath = $root.TrimEnd('*')",
    '  if (-not (Test-Path -Path $basePath)) {',
    '    [PSCustomObject]@{ ok = $true; items = @() } | ConvertTo-Json -Depth 6 -Compress',
    '    exit 0',
    '  }',
    '  $items = @(',
    '    Get-ChildItem -Path $root -ErrorAction Stop | ForEach-Object {',
    '      $properties = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue',
    '      [PSCustomObject]@{',
    '        keyName = $_.PSChildName',
    "        defaultValue = [string]$properties.'(default)'",
    '        path = [string]$properties.Path',
    '      }',
    '    }',
    '  )',
    '  [PSCustomObject]@{ ok = $true; items = $items } | ConvertTo-Json -Depth 6 -Compress',
    '} catch {',
    "  $errorMessage = if ($_.Exception -and $_.Exception.Message) { $_.Exception.Message } else { $_ | Out-String }",
    '  [PSCustomObject]@{ ok = $false; error = [string]$errorMessage } | ConvertTo-Json -Depth 6 -Compress',
    '  exit 0',
    '}',
  ].join('\n');
}

// 为了生成读取 Uninstall 分支的多行 PowerShell 脚本。
function buildUninstallScript(registryPath: string): string {
  const escapedPath = escapePowerShellString(registryPath);
  return [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    "$ErrorActionPreference = 'Stop'",
    'try {',
    `  $root = '${escapedPath}'`,
    "  $basePath = $root.TrimEnd('*')",
    '  if (-not (Test-Path -Path $basePath)) {',
    '    [PSCustomObject]@{ ok = $true; items = @() } | ConvertTo-Json -Depth 6 -Compress',
    '    exit 0',
    '  }',
    '  $items = @(',
    '    Get-ItemProperty -Path $root -ErrorAction Stop | ForEach-Object {',
    '      [PSCustomObject]@{',
    '        keyName = $_.PSChildName',
    '        displayName = [string]$_.DisplayName',
    '        displayIcon = [string]$_.DisplayIcon',
    '        installLocation = [string]$_.InstallLocation',
    '      }',
    '    }',
    '  )',
    '  [PSCustomObject]@{ ok = $true; items = $items } | ConvertTo-Json -Depth 6 -Compress',
    '} catch {',
    "  $errorMessage = if ($_.Exception -and $_.Exception.Message) { $_.Exception.Message } else { $_ | Out-String }",
    '  [PSCustomObject]@{ ok = $false; error = [string]$errorMessage } | ConvertTo-Json -Depth 6 -Compress',
    '  exit 0',
    '}',
  ].join('\n');
}

// 为了展开注册表里常见的环境变量占位符。
function expandEnvironmentVariables(value: string): string {
  const envEntries = Object.entries(process.env).reduce<Record<string, string>>((result, [key, currentValue]) => {
    result[key.toUpperCase()] = currentValue ?? '';
    return result;
  }, {});

  return value.replace(/%([^%]+)%/g, (match, variableName) => {
    const resolved = envEntries[String(variableName).toUpperCase()];
    return resolved ? resolved : match;
  });
}

// 为了清洗注册表里的路径类字符串。
function cleanRegistryValue(value?: string | null): string {
  if (!value) {
    return '';
  }

  return cleanUtf8Text(expandEnvironmentVariables(String(value))).replace(/^['"]+|['"]+$/g, '').replace(/\//g, '\\');
}

// 为了移除 DisplayIcon 尾部的资源索引标记。
function stripIconIndexSuffix(value: string): string {
  return value.replace(/,\s*-?\d+\s*$/u, '').trim();
}

// 为了规范化 Windows 目录路径并去掉末尾分隔符。
function normalizeDirectoryPath(directoryPath?: string | null): string {
  const cleaned = cleanRegistryValue(directoryPath);
  if (!cleaned) {
    return '';
  }

  const normalized = path.win32.normalize(cleaned);
  return normalized.replace(/[\\/]+$/u, '');
}

// 为了从注册表原始值里提取可执行文件绝对路径。
function extractExecutablePath(rawValue?: string | null): string {
  const cleaned = stripIconIndexSuffix(cleanRegistryValue(rawValue));
  if (!cleaned) {
    return '';
  }

  const quotedMatch = cleaned.match(/"([^"]+?\.exe)"/iu);
  const fallbackIndex = cleaned.toLowerCase().indexOf('.exe');
  const candidate = quotedMatch?.[1] ?? (fallbackIndex >= 0 ? cleaned.slice(0, fallbackIndex + 4) : '');
  const normalized = cleanRegistryValue(candidate);

  if (!normalized || path.win32.extname(normalized).toLowerCase() !== '.exe' || !path.win32.isAbsolute(normalized)) {
    return '';
  }

  return path.win32.normalize(normalized);
}

// 为了从可执行文件路径推导稳定的进程名字段。
function buildProcessNames(exePath: string): string[] {
  const fileName = path.win32.basename(exePath).toLowerCase();
  return fileName ? [fileName] : [];
}

// 为了从文件名中提取无扩展名的展示名称。
function fileNameWithoutExtension(fileName: string): string {
  return path.win32.basename(fileName, path.win32.extname(fileName));
}

// 为了统一生成应用去重键。
function getAppSourceKey(exePath: string): string {
  return exePath.toLowerCase();
}

// 为了获取或创建单个应用的合并来源对象。
function getOrCreateSource(sources: Map<string, AppSource>, exePath: string): AppSource {
  const sourceKey = getAppSourceKey(exePath);
  const existing = sources.get(sourceKey);
  if (existing) {
    return existing;
  }

  const created: AppSource = {
    exePath,
    appPathsPath: '',
    appPathsKeyName: '',
    uninstallName: '',
    uninstallInstallLocation: '',
  };
  sources.set(sourceKey, created);
  return created;
}

// 为了按安装目录建立可复用的应用索引。
function registerInstallDir(installDirIndex: Map<string, string>, source: AppSource): void {
  const installDir = normalizeDirectoryPath(source.uninstallInstallLocation || source.appPathsPath || path.win32.dirname(source.exePath));
  if (!installDir) {
    return;
  }

  installDirIndex.set(installDir.toLowerCase(), getAppSourceKey(source.exePath));
}

// 为了读取单个 App Paths 注册表分支并容错降级。
async function readAppPathBranch(registryPath: string): Promise<RegistryAppPathRecord[]> {
  try {
    const records = await runPowerShellJson<RegistryAppPathRecord>(buildAppPathsScript(registryPath), registryPath);
    logger.info(MODULE_NAME, `读取 App Paths 分支成功：${registryPath}，数量：${records.length}`);
    return records;
  } catch (error) {
    const message = cleanUtf8Text(error instanceof Error ? error.message : String(error));
    logger.warn(MODULE_NAME, message || `读取 App Paths 分支失败：${registryPath}`);
    return [];
  }
}

// 为了读取单个 Uninstall 注册表分支并容错降级。
async function readUninstallBranch(registryPath: string): Promise<RegistryUninstallRecord[]> {
  try {
    const records = await runPowerShellJson<RegistryUninstallRecord>(buildUninstallScript(registryPath), registryPath);
    logger.info(MODULE_NAME, `读取 Uninstall 分支成功：${registryPath}，数量：${records.length}`);
    return records;
  } catch (error) {
    const message = cleanUtf8Text(error instanceof Error ? error.message : String(error));
    logger.warn(MODULE_NAME, message || `读取 Uninstall 分支失败：${registryPath}`);
    return [];
  }
}

// 为了把 App Paths 数据合并为基础应用来源。
function mergeAppPathSources(records: RegistryAppPathRecord[], sources: Map<string, AppSource>): void {
  records.forEach((record) => {
    const exePath = extractExecutablePath(record.defaultValue);
    if (!exePath) {
      return;
    }

    const source = getOrCreateSource(sources, exePath);
    const appPathsPath = normalizeDirectoryPath(record.path);
    const keyName = cleanRegistryValue(record.keyName);

    if (appPathsPath && !source.appPathsPath) {
      source.appPathsPath = appPathsPath;
    }

    if (keyName && !source.appPathsKeyName) {
      source.appPathsKeyName = fileNameWithoutExtension(keyName);
    }
  });
}

// 为了把包含可执行路径的卸载项合并到应用来源。
function mergeUninstallSources(records: RegistryUninstallRecord[], sources: Map<string, AppSource>): void {
  records.forEach((record) => {
    const exePath = extractExecutablePath(record.displayIcon);
    if (!exePath) {
      return;
    }

    const source = getOrCreateSource(sources, exePath);
    const displayName = cleanRegistryValue(record.displayName);
    const installLocation = normalizeDirectoryPath(record.installLocation);

    if (displayName && !source.uninstallName) {
      source.uninstallName = displayName;
    }

    if (installLocation) {
      source.uninstallInstallLocation = installLocation;
    }
  });
}

// 为了把只有安装目录的卸载项补充到已有应用来源。
function mergeUninstallMetadata(records: RegistryUninstallRecord[], sources: Map<string, AppSource>): void {
  const installDirIndex = new Map<string, string>();
  sources.forEach((source) => registerInstallDir(installDirIndex, source));

  records.forEach((record) => {
    if (extractExecutablePath(record.displayIcon)) {
      return;
    }

    const installLocation = normalizeDirectoryPath(record.installLocation);
    if (!installLocation) {
      return;
    }

    const sourceKey = installDirIndex.get(installLocation.toLowerCase());
    if (!sourceKey) {
      return;
    }

    const source = sources.get(sourceKey);
    if (!source) {
      return;
    }

    const displayName = cleanRegistryValue(record.displayName);
    if (displayName && !source.uninstallName) {
      source.uninstallName = displayName;
    }

    if (!source.uninstallInstallLocation) {
      source.uninstallInstallLocation = installLocation;
    }
  });
}

// 为了把内部来源对象转换为前端可消费的扫描结果。
function toScannedApp(source: AppSource): ScannedApp {
  const exeName = path.win32.basename(source.exePath);
  const name =
    cleanRegistryValue(source.uninstallName) ||
    fileNameWithoutExtension(exeName) ||
    cleanRegistryValue(source.appPathsKeyName) ||
    '应用';

  return {
    name,
    exePath: source.exePath,
    installDir:
      normalizeDirectoryPath(source.uninstallInstallLocation) ||
      normalizeDirectoryPath(source.appPathsPath) ||
      normalizeDirectoryPath(path.win32.dirname(source.exePath)),
    iconPath: '',
    customProcessNames: buildProcessNames(source.exePath),
  };
}

// 为了稳定排序扫描结果并降低列表抖动。
function sortScannedApps(apps: ScannedApp[]): ScannedApp[] {
  return apps.sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name, 'zh-CN');
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return left.exePath.localeCompare(right.exePath, 'en');
  });
}

// 为了扫描注册表中的已安装应用并生成应用列表。
export async function scanInstalledApps(): Promise<ScannedApp[]> {
  if (process.platform !== 'win32') {
    logger.warn(MODULE_NAME, '当前系统不是 Windows，返回空应用列表');
    return [];
  }

  try {
    const [appPathBranches, uninstallBranches] = await Promise.all([
      Promise.all(APP_PATH_REGISTRY_PATHS.map((registryPath) => readAppPathBranch(registryPath))),
      Promise.all(UNINSTALL_REGISTRY_PATHS.map((registryPath) => readUninstallBranch(registryPath))),
    ]);

    const appPathRecords = appPathBranches.flat();
    const uninstallRecords = uninstallBranches.flat();
    const sources = new Map<string, AppSource>();

    mergeAppPathSources(appPathRecords, sources);
    mergeUninstallSources(uninstallRecords, sources);
    mergeUninstallMetadata(uninstallRecords, sources);

    const apps = sortScannedApps(Array.from(sources.values(), (source) => toScannedApp(source)));
    logger.info(
      MODULE_NAME,
      `注册表应用扫描完成，App Paths：${appPathRecords.length}，Uninstall：${uninstallRecords.length}，结果：${apps.length}`,
    );
    return apps;
  } catch (error) {
    const message = cleanUtf8Text(error instanceof Error ? error.message : String(error));
    logger.error(MODULE_NAME, message || '注册表应用扫描失败，返回空列表');
    return [];
  }
}
