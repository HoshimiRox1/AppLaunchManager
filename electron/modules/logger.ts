import { appendFileSync } from 'node:fs';
import path from 'node:path';

import { getRuntimePaths } from './runtimePaths';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatTimestamp(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
}

function normalizeMessage(message: string, error?: unknown): string {
  if (!error) {
    return message;
  }

  if (error instanceof Error) {
    return `${message} | ${error.message}`;
  }

  return `${message} | ${String(error)}`;
}

function writeLog(level: LogLevel, moduleName: string, message: string, error?: unknown): void {
  const logFilePath = path.join(getRuntimePaths().logsDir, 'main.log');
  const line = `${formatTimestamp()} | [${level}] ${moduleName}：${normalizeMessage(message, error)}\n`;
  appendFileSync(logFilePath, line, 'utf8');
}

export const logger = {
  info(moduleName: string, message: string): void {
    writeLog('INFO', moduleName, message);
  },
  warn(moduleName: string, message: string, error?: unknown): void {
    writeLog('WARN', moduleName, message, error);
  },
  error(moduleName: string, message: string, error?: unknown): void {
    writeLog('ERROR', moduleName, message, error);
  },
};
