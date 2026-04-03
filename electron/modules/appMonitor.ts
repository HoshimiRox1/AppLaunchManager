import path from 'node:path';

import type { AppEntry, AppStatus } from '../../src/types';
import { logger } from './logger';
import { runPowerShellScript } from './powerShell';
import { readPresetsFromStore } from './presetStore';

interface RunningProcessInfo {
  processId: number;
  name: string;
  executablePath: string;
}

const MODULE_NAME = 'appMonitor.ts';
const POLL_INTERVAL_MS = 5000;
const listeners = new Set<(statuses: AppStatus[]) => void>();
const LIST_RUNNING_PROCESSES_SCRIPT = `
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
  chcp 65001 | Out-Null;
  Get-CimInstance Win32_Process |
    Where-Object { $_.ExecutablePath -ne $null } |
    Select-Object ProcessId, Name, ExecutablePath |
    ConvertTo-Json -Compress
`;

let currentStatuses: AppStatus[] = [];
let pollingTimer: NodeJS.Timeout | null = null;
let isPolling = false;

// 为了统一规范化进程路径和监测目录的比较格式。
function normalizeComparisonPath(value: string): string {
  const cleaned = value.trim().replace(/\//g, '\\');
  if (!cleaned) {
    return '';
  }

  return path.win32.normalize(cleaned).replace(/[\\/]+$/u, '').toLowerCase();
}

// 为了生成当前所有预设中需要监测的唯一应用列表。
function getTrackedApps(): AppEntry[] {
  const appMap = new Map<string, AppEntry>();

  readPresetsFromStore()
    .slice()
    .sort((left, right) => left.order - right.order)
    .forEach((preset) => {
      preset.apps.forEach((appEntry) => {
        if (!appMap.has(appEntry.id)) {
          appMap.set(appEntry.id, appEntry);
        }
      });
    });

  return Array.from(appMap.values());
}

// 为了在监控尚未完成首轮扫描时提供默认的停止状态快照。
function createStoppedStatuses(): AppStatus[] {
  return getTrackedApps().map((appEntry) => ({
    appId: appEntry.id,
    isRunning: false,
  }));
}

// 为了把最新应用状态广播给已订阅的监听者。
function emitStatuses(statuses: AppStatus[] = currentStatuses): void {
  listeners.forEach((listener) => listener(statuses));
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
      processId: typeof item.ProcessId === 'number' ? item.ProcessId : 0,
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

// 为了基于当前进程快照生成 renderer 需要的 AppStatus 列表。
function buildStatuses(processes: RunningProcessInfo[]): AppStatus[] {
  return getTrackedApps().map((appEntry) => ({
    appId: appEntry.id,
    isRunning: processes.some((processInfo) =>
      isProcessUnderInstallDir(processInfo.executablePath, appEntry.installDir || path.win32.dirname(appEntry.exePath)),
    ),
  }));
}

// 为了执行一次完整的监控轮询并更新缓存状态。
async function runPollTick(source: 'startup' | 'poll'): Promise<void> {
  const raw = runPowerShellScript(LIST_RUNNING_PROCESSES_SCRIPT);
  const processes = parseRunningProcesses(raw);
  currentStatuses = buildStatuses(processes);
  emitStatuses(currentStatuses);
  logger.info(MODULE_NAME, `完成状态刷新：${source} | 应用数量：${currentStatuses.length} | 进程数量：${processes.length}`);
}

// 为了在应用启动后建立唯一的轮询任务并立即完成首轮状态同步。
export async function startMonitoring(): Promise<void> {
  if (pollingTimer) {
    return;
  }

  currentStatuses = createStoppedStatuses();

  try {
    await runPollTick('startup');
  } catch (error) {
    logger.warn(MODULE_NAME, `Poll tick error: ${String(error)}`);
  }

  pollingTimer = setInterval(async () => {
    if (isPolling) {
      return;
    }

    isPolling = true;
    try {
      await runPollTick('poll');
    } catch (error) {
      logger.warn(MODULE_NAME, `Poll tick error: ${String(error)}`);
    } finally {
      isPolling = false;
    }
  }, POLL_INTERVAL_MS);

  logger.info(MODULE_NAME, `已启动状态轮询：${POLL_INTERVAL_MS}ms`);
}

// 为了在主进程退出时清理轮询定时器。
export function stopMonitoring(): void {
  if (!pollingTimer) {
    return;
  }

  clearInterval(pollingTimer);
  pollingTimer = null;
  logger.info(MODULE_NAME, '已停止状态轮询');
}

// 为了向主进程提供可复用的状态订阅入口。
export function subscribeToStatuses(listener: (statuses: AppStatus[]) => void): () => void {
  listeners.add(listener);
  listener(currentStatuses.length > 0 ? currentStatuses : createStoppedStatuses());
  return () => listeners.delete(listener);
}

// 为了给 IPC 层返回最新的应用运行状态快照。
export async function getStatuses(): Promise<AppStatus[]> {
  if (!pollingTimer) {
    await startMonitoring();
  }

  return currentStatuses.length > 0 ? currentStatuses : createStoppedStatuses();
}
