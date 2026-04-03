import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { enumerateKeysSafe, enumerateValuesSafe, HKEY } from 'registry-js';

import type { ScannedApp } from '../src/types';
import { logger } from './logger';

interface RegistryBranch {
  hive: HKEY;
  subkey: string;
}

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

interface RegistryValueEntry {
  name: string;
  data: string | number;
}

const MODULE_NAME = 'appScanner.ts';
const APP_PATH_REGISTRY_BRANCHES: RegistryBranch[] = [
  {
    hive: HKEY.HKEY_LOCAL_MACHINE,
    subkey: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  },
  {
    hive: HKEY.HKEY_LOCAL_MACHINE,
    subkey: 'SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  },
  {
    hive: HKEY.HKEY_CURRENT_USER,
    subkey: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  },
];
const UNINSTALL_REGISTRY_BRANCHES: RegistryBranch[] = [
  {
    hive: HKEY.HKEY_LOCAL_MACHINE,
    subkey: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  },
  {
    hive: HKEY.HKEY_LOCAL_MACHINE,
    subkey: 'SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  },
  {
    hive: HKEY.HKEY_CURRENT_USER,
    subkey: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  },
];
const EXCLUDED_EXECUTABLE_PATTERNS = ['uninstall', 'setup', 'update', 'updater', 'helper', 'crash', 'repair'];

// 为了清洗注册表和文件系统里的文本噪音。
function cleanText(value?: string | null): string {
  if (!value) {
    return '';
  }

  return String(value).replace(/^\uFEFF/u, '').replace(/\0/g, '').trim();
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

// 为了生成稳定可读的注册表分支日志标识。
function formatRegistryBranch(branch: RegistryBranch): string {
  return `${branch.hive}\\${branch.subkey}`;
}

// 为了清洗注册表里的路径类字符串。
function cleanRegistryValue(value?: string | null): string {
  if (!value) {
    return '';
  }

  return cleanText(expandEnvironmentVariables(String(value))).replace(/^['"]+|['"]+$/g, '').replace(/\//g, '\\');
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

// 为了移除 DisplayIcon 尾部的资源索引标记。
function stripIconIndexSuffix(value: string): string {
  return value.replace(/,\s*-?\d+\s*$/u, '').trim();
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

// 为了统一比较文件名和显示名称的相似度。
function normalizeComparableText(value: string): string {
  return cleanText(value)
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\.exe$/iu, '')
    .replace(/[\s._()\-]+/gu, '');
}

// 为了判断候选可执行文件是否像主程序而不是工具程序。
function isExcludedExecutableName(fileName: string): boolean {
  const normalizedName = normalizeComparableText(fileName);
  return EXCLUDED_EXECUTABLE_PATTERNS.some((pattern) => normalizedName.includes(pattern));
}

// 为了过滤注册表返回值中的异常项。
function normalizeRegistryValues(values: ReadonlyArray<unknown>): RegistryValueEntry[] {
  return values.filter((entry): entry is RegistryValueEntry => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const maybeEntry = entry as { name?: unknown; data?: unknown };
    return typeof maybeEntry.name === 'string' && (typeof maybeEntry.data === 'string' || typeof maybeEntry.data === 'number');
  });
}

// 为了从注册表值集合中提取字符串字段。
function getRegistryStringValue(values: ReadonlyArray<RegistryValueEntry>, valueName: string): string {
  const matchedValue = values.find((entry) => entry.name === valueName);
  return matchedValue && typeof matchedValue.data === 'string' ? matchedValue.data : '';
}

// 为了安全读取注册表分支下的所有子键名。
function enumerateBranchKeys(branch: RegistryBranch): string[] {
  try {
    return [...enumerateKeysSafe(branch.hive, branch.subkey)].filter((entry): entry is string => typeof entry === 'string' && Boolean(entry));
  } catch (error) {
    logger.warn(MODULE_NAME, `读取注册表子键失败：${formatRegistryBranch(branch)} | ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

// 为了安全读取单个注册表子键下的值集合。
function enumerateBranchValues(branch: RegistryBranch, keyName: string): RegistryValueEntry[] {
  try {
    return normalizeRegistryValues(enumerateValuesSafe(branch.hive, `${branch.subkey}\\${keyName}`));
  } catch (error) {
    logger.warn(
      MODULE_NAME,
      `读取注册表键值失败：${formatRegistryBranch(branch)}\\${keyName} | ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

// 为了读取 App Paths 分支里的原始应用记录。
function readAppPathBranch(branch: RegistryBranch): RegistryAppPathRecord[] {
  const keyNames = enumerateBranchKeys(branch);
  const records = keyNames.map((keyName) => {
    const values = enumerateBranchValues(branch, keyName);
    return {
      keyName,
      defaultValue: getRegistryStringValue(values, ''),
      path: getRegistryStringValue(values, 'Path'),
    };
  });

  logger.info(MODULE_NAME, `读取 App Paths 分支成功：${formatRegistryBranch(branch)}，数量：${records.length}`);
  return records;
}

// 为了读取 Uninstall 分支里的原始应用记录并隔离单键失败。
function readUninstallBranch(branch: RegistryBranch): RegistryUninstallRecord[] {
  const keyNames = enumerateBranchKeys(branch);
  const records: RegistryUninstallRecord[] = [];

  keyNames.forEach((keyName) => {
    try {
      const values = enumerateBranchValues(branch, keyName);
      records.push({
        keyName,
        displayName: getRegistryStringValue(values, 'DisplayName'),
        displayIcon: getRegistryStringValue(values, 'DisplayIcon'),
        installLocation: getRegistryStringValue(values, 'InstallLocation'),
      });
    } catch (error) {
      logger.warn(
        MODULE_NAME,
        `解析 Uninstall 子键失败：${formatRegistryBranch(branch)}\\${keyName} | ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  logger.info(MODULE_NAME, `读取 Uninstall 分支成功：${formatRegistryBranch(branch)}，数量：${records.length}`);
  return records;
}

// 为了从文件名中提取无扩展名的展示名称。
function fileNameWithoutExtension(fileName: string): string {
  return path.win32.basename(fileName, path.win32.extname(fileName));
}

// 为了从可执行文件路径推导稳定的进程名字段。
function buildProcessNames(exePath: string): string[] {
  const fileName = path.win32.basename(exePath).toLowerCase();
  return fileName ? [fileName] : [];
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

// 为了为安装目录中的可执行文件计算候选得分。
function scoreExecutableCandidate(candidatePath: string, hints: string[]): number {
  const baseName = fileNameWithoutExtension(path.win32.basename(candidatePath));
  const normalizedCandidate = normalizeComparableText(baseName);
  if (!normalizedCandidate) {
    return -1;
  }

  if (isExcludedExecutableName(baseName)) {
    return -1;
  }

  let score = 0;
  hints.forEach((hint) => {
    if (!hint) {
      return;
    }

    if (normalizedCandidate === hint) {
      score += 100;
      return;
    }

    if (normalizedCandidate.includes(hint) || hint.includes(normalizedCandidate)) {
      score += 40;
    }
  });

  return score;
}

// 为了从安装目录中推导更像主程序的可执行文件。
function inferExecutableFromInstallLocation(record: RegistryUninstallRecord): string {
  const installDir = normalizeDirectoryPath(record.installLocation);
  if (!installDir || !existsSync(installDir)) {
    return '';
  }

  let candidatePaths: string[] = [];
  try {
    candidatePaths = readdirSync(installDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => path.win32.extname(fileName).toLowerCase() === '.exe')
      .map((fileName) => path.win32.join(installDir, fileName));
  } catch (error) {
    logger.warn(
      MODULE_NAME,
      `读取安装目录失败：${installDir} | ${error instanceof Error ? error.message : String(error)}`,
    );
    return '';
  }

  if (candidatePaths.length === 0) {
    return '';
  }

  const hints = [record.displayName, record.keyName, path.win32.basename(installDir)]
    .map((value) => normalizeComparableText(value ?? ''))
    .filter(Boolean);

  const scoredCandidates = candidatePaths
    .map((candidatePath) => ({
      path: candidatePath,
      score: scoreExecutableCandidate(candidatePath, hints),
    }))
    .filter((candidate) => candidate.score >= 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path, 'en'));

  if (scoredCandidates.length === 0) {
    return '';
  }

  if (scoredCandidates[0].score > 0) {
    return scoredCandidates[0].path;
  }

  return scoredCandidates.length === 1 ? scoredCandidates[0].path : '';
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

// 为了把卸载信息中的主程序路径合并到应用来源。
function mergeUninstallSources(records: RegistryUninstallRecord[], sources: Map<string, AppSource>): void {
  records.forEach((record) => {
    const exePath = extractExecutablePath(record.displayIcon) || inferExecutableFromInstallLocation(record);
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
    if (extractExecutablePath(record.displayIcon) || inferExecutableFromInstallLocation(record)) {
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
    const appPathRecords = APP_PATH_REGISTRY_BRANCHES.flatMap((branch) => readAppPathBranch(branch));
    const uninstallRecords = UNINSTALL_REGISTRY_BRANCHES.flatMap((branch) => readUninstallBranch(branch));
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
    logger.error(MODULE_NAME, `注册表应用扫描失败，返回空列表 | ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
