import { mkdirSync } from 'node:fs';
import path from 'node:path';

export interface RuntimePaths {
  runtimeRoot: string;
  userDataDir: string;
  sessionDataDir: string;
  cacheDir: string;
  logsDir: string;
  dataDir: string;
}

function ensureDirectory(directoryPath: string): string {
  mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
}

export function getRuntimePaths(): RuntimePaths {
  const runtimeRoot = path.resolve(process.cwd(), '.runtime');

  return {
    runtimeRoot,
    userDataDir: ensureDirectory(path.join(runtimeRoot, 'user-data')),
    sessionDataDir: ensureDirectory(path.join(runtimeRoot, 'session-data')),
    cacheDir: ensureDirectory(path.join(runtimeRoot, 'cache')),
    logsDir: ensureDirectory(path.join(runtimeRoot, 'logs')),
    dataDir: ensureDirectory(path.join(runtimeRoot, 'data')),
  };
}
