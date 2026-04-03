import path from 'node:path';

import type { AppEntry, Preset, StopPresetResponse } from '../../src/types';
import { isAdminModeEnabled } from './settingsService';
import { logger } from './logger';
import { runElevatedPowerShellScript, runPowerShellScript } from './powerShell';
import { readPresetsFromStore } from './presetStore';

interface RunningProcessInfo {
  name: string;
  executablePath: string;
}

const MODULE_NAME = 'appKiller.ts';
const HIGH_RISK_PROCESS_NAMES = [
  'winword.exe',
  'excel.exe',
  'powerpnt.exe',
  'notepad++.exe',
  'code.exe',
  'sublime_text.exe',
];
const LIST_RUNNING_PROCESSES_SCRIPT = `
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
  chcp 65001 | Out-Null;
  Get-CimInstance Win32_Process |
    Where-Object { $_.ExecutablePath -ne $null } |
    Select-Object Name, ExecutablePath |
    ConvertTo-Json -Compress
`;

// 为了统一规范化进程路径和监测目录的比较格式。
function normalizeComparisonPath(value: string): string {
  const cleaned = value.trim().replace(/\//g, '\\');
  if (!cleaned) {
    return '';
  }

  return path.win32.normalize(cleaned).replace(/[\\/]+$/u, '').toLowerCase();
}

// 为了统一规范化高风险进程名称的比较格式。
function normalizeProcessName(value: string): string {
  return value.trim().toLowerCase();
}

// 为了让 PowerShell 字符串插值能够安全处理单引号。
function escapePowerShellString(value: string): string {
  return value.replace(/'/g, "''");
}

// 为了把 PowerShell 返回的进程列表安全解析为统一结构。
function parseRunningProcesses(raw: string): RunningProcessInfo[] {
  if (!raw.trim()) {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;
  const items = Array.isArray(parsed) ? parsed : [parsed];

  return items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      name: typeof item.Name === 'string' ? item.Name : '',
      executablePath: typeof item.ExecutablePath === 'string' ? item.ExecutablePath : '',
    }));
}

// 为了用 installDir 前缀匹配判断某个进程是否属于目标应用。
function isProcessUnderInstallDir(executablePath: string, installDir: string): boolean {
  const normalizedExecutablePath = normalizeComparisonPath(executablePath);
  const normalizedInstallDir = normalizeComparisonPath(installDir);
  if (!normalizedExecutablePath || !normalizedInstallDir) {
    return false;
  }

  return normalizedExecutablePath.startsWith(`${normalizedInstallDir}\\`);
}

// 为了从预设存储中读取当前要操作的目标预设。
function getPresetById(presetId: string): Preset | undefined {
  return readPresetsFromStore().find((preset) => preset.id === presetId);
}

// 为了在关闭应用前识别可能存在未保存内容的高风险应用。
async function checkRiskyApps(preset: Preset): Promise<string[]> {
  const processes = parseRunningProcesses(runPowerShellScript(LIST_RUNNING_PROCESSES_SCRIPT));
  const riskyAppNames = new Set<string>();

  preset.apps.forEach((appEntry) => {
    const installDir = appEntry.installDir || path.win32.dirname(appEntry.exePath);
    const hasRiskyProcess = processes.some(
      (processInfo) =>
        isProcessUnderInstallDir(processInfo.executablePath, installDir) &&
        HIGH_RISK_PROCESS_NAMES.includes(normalizeProcessName(processInfo.name)),
    );

    if (hasRiskyProcess) {
      riskyAppNames.add(appEntry.name);
    }
  });

  return Array.from(riskyAppNames);
}

// 为了使用 installDir 路径范围关闭单个应用关联的全部进程。
async function killApp(appEntry: AppEntry, adminMode: boolean): Promise<void> {
  const installDir = (appEntry.installDir || path.win32.dirname(appEntry.exePath)).trim();
  if (!installDir) {
    return;
  }

  const escapedDir = escapePowerShellString(installDir);
  const psKillCommand = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
    chcp 65001 | Out-Null;
    Get-CimInstance Win32_Process |
      Where-Object { $_.ExecutablePath -ne $null -and $_.ExecutablePath.ToLower().StartsWith('${escapedDir.toLowerCase()}') } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  `;

  if (adminMode) {
    runElevatedPowerShellScript(psKillCommand);
  } else {
    runPowerShellScript(psKillCommand);
  }

  logger.info(MODULE_NAME, `已关闭目录下的全部进程：${installDir}`);
}

// 为了在无需确认或用户确认后顺序关闭预设内的所有应用。
async function killPreset(preset: Preset): Promise<void> {
  const adminMode = await isAdminModeEnabled();
  for (const appEntry of preset.apps) {
    try {
      await killApp(appEntry, adminMode);
    } catch (error) {
      logger.warn(MODULE_NAME, `关闭应用失败：${appEntry.name}`, error);
    }
  }
}

// 为了在首次点击关闭时先完成高风险检查再决定是否直接执行。
export async function stopPreset(presetId: string): Promise<StopPresetResponse> {
  const preset = getPresetById(presetId);
  if (!preset) {
    logger.warn(MODULE_NAME, `未找到要关闭的预设：${presetId}`);
    return {
      needsConfirm: false,
      riskyApps: [],
    };
  }

  const riskyApps = await checkRiskyApps(preset);
  if (riskyApps.length > 0) {
    logger.warn(MODULE_NAME, `命中高风险应用，等待确认：${riskyApps.join(', ')}`);
    return {
      needsConfirm: true,
      riskyApps,
    };
  }

  await killPreset(preset);
  return {
    needsConfirm: false,
    riskyApps: [],
  };
}

// 为了在用户确认后跳过风险检查直接执行预设关闭。
export async function confirmStop(presetId: string): Promise<void> {
  const preset = getPresetById(presetId);
  if (!preset) {
    logger.warn(MODULE_NAME, `未找到要确认关闭的预设：${presetId}`);
    return;
  }

  await killPreset(preset);
}
