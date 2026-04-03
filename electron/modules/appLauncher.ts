import path from 'node:path';

import type { AppEntry } from '../../src/types';
import { logger } from './logger';
import { runPowerShellScript } from './powerShell';
import { readPresetsFromStore } from './presetStore';

const MODULE_NAME = 'appLauncher.ts';

// 为了让 PowerShell 字符串插值能够安全处理单引号。
function escapePowerShellString(value: string): string {
  return value.replace(/'/g, "''");
}

// 为了为单个应用生成稳定的启动工作目录。
function resolveWorkingDirectory(appEntry: AppEntry): string {
  return (appEntry.installDir || path.win32.dirname(appEntry.exePath)).trim();
}

// 为了使用 exePath 顺序启动预设中的单个应用。
async function launchApp(appEntry: AppEntry): Promise<void> {
  const escapedExePath = escapePowerShellString(appEntry.exePath.trim());
  const escapedWorkingDirectory = escapePowerShellString(resolveWorkingDirectory(appEntry));
  const launchScript = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
    chcp 65001 | Out-Null;
    $process = Start-Process -FilePath '${escapedExePath}' -WorkingDirectory '${escapedWorkingDirectory}' -PassThru -ErrorAction Stop;
    [PSCustomObject]@{ ProcessId = [int]$process.Id } | ConvertTo-Json -Compress
  `;

  runPowerShellScript(launchScript);
  logger.info(MODULE_NAME, `已发起启动：${appEntry.name} | ${appEntry.exePath}`);
}

// 为了按顺序启动指定预设中的所有应用。
export async function startPreset(presetId: string): Promise<void> {
  const preset = readPresetsFromStore().find((item) => item.id === presetId);
  if (!preset) {
    logger.warn(MODULE_NAME, `未找到要启动的预设：${presetId}`);
    return;
  }

  for (const appEntry of preset.apps) {
    try {
      await launchApp(appEntry);
    } catch (error) {
      logger.warn(MODULE_NAME, `启动应用失败：${appEntry.name}`, error);
    }
  }
}
