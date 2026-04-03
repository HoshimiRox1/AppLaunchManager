import type { AppEntry, Preset, ScannedApp } from '../types';

const tonePairs = [
  'from-amber-200 to-amber-300 text-amber-950',
  'from-rose-200 to-rose-300 text-rose-950',
  'from-lime-200 to-lime-300 text-lime-950',
  'from-sky-200 to-sky-300 text-sky-950',
  'from-orange-200 to-orange-300 text-orange-950',
  'from-stone-200 to-stone-300 text-stone-950',
];

export function reorderItems<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function pathBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastPart = normalized.split('/').filter(Boolean).pop() ?? '应用';
  return lastPart.replace(/\.[^.]+$/, '');
}

export function inferInstallDir(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  parts.pop();
  return filePath.includes('\\') ? parts.join('\\') : parts.join('/');
}

export function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'A';
  }

  if (trimmed.length <= 2) {
    return trimmed.toUpperCase();
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');
  }

  return trimmed.slice(0, 2).toUpperCase();
}

export function toneClass(seed: string): string {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return tonePairs[total % tonePairs.length];
}

export function toAppEntry(scanned: ScannedApp): AppEntry {
  return {
    id: crypto.randomUUID(),
    name: scanned.name,
    exePath: scanned.exePath,
    installDir: scanned.installDir,
    iconPath: scanned.iconPath,
    customProcessNames: scanned.customProcessNames,
  };
}

export function createCustomAppEntry(input: { name?: string; exePath: string; iconPath: string }): AppEntry {
  const exePath = input.exePath.trim();
  const name = input.name?.trim() || pathBaseName(exePath);
  const processName = `${pathBaseName(exePath).toLowerCase()}.exe`;

  return {
    id: crypto.randomUUID(),
    name,
    exePath,
    installDir: inferInstallDir(exePath),
    iconPath: input.iconPath,
    customProcessNames: [processName],
  };
}

export function sortedPresets(presets: Preset[]): Preset[] {
  return presets.slice().sort((left, right) => left.order - right.order);
}

export function normalizePresetOrders(presets: Preset[]): Preset[] {
  return sortedPresets(presets).map((preset, index) => ({
    ...preset,
    order: index,
  }));
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ensurePresetHasApp(preset: Preset, appId: string): boolean {
  return preset.apps.some((appEntry) => appEntry.id === appId);
}
