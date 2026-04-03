import { useEffect, useMemo, useState } from 'react';

import type { AppEntry, Preset, ScannedApp } from '../../types';
import { createCustomAppEntry, toAppEntry } from '../../lib/utils';
import AppPickerItem from './AppPickerItem';
import CustomAppForm from './CustomAppForm';

interface AppPickerProps {
  appList: ScannedApp[];
  isLoading: boolean;
  onAddApp: (appEntry: AppEntry) => void;
  onClose: () => void;
  onEnsureLoaded: () => Promise<void>;
  preset: Preset;
}

// 为了统一搜索词与应用字段的大小写和字符形态。
function normalizeSearchText(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase();
}

export default function AppPicker({ appList, isLoading, onAddApp, onClose, onEnsureLoaded, preset }: AppPickerProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    void onEnsureLoaded();
  }, [onEnsureLoaded]);

  const presetPaths = useMemo(() => new Set(preset.apps.map((appEntry) => appEntry.exePath)), [preset.apps]);
  const normalizedKeyword = useMemo(() => normalizeSearchText(search), [search]);

  const filteredApps = useMemo(
    () =>
      appList.filter((app) => {
        if (presetPaths.has(app.exePath)) {
          return false;
        }

        if (!normalizedKeyword) {
          return true;
        }

        const normalizedName = normalizeSearchText(app.name);
        const normalizedPath = normalizeSearchText(app.exePath);
        return normalizedName.includes(normalizedKeyword) || normalizedPath.includes(normalizedKeyword);
      }),
    [appList, normalizedKeyword, presetPaths],
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);

    files.forEach((file) => {
      const filePath = (file as File & { path?: string }).path;
      if (!filePath) {
        return;
      }

      onAddApp(createCustomAppEntry({ exePath: filePath, iconPath: '' }));
    });
  };

  return (
    <div
      className="mt-4 rounded-[24px] border border-cream-border bg-cream-bg/80 p-4 shadow-card transition duration-200"
      onClick={(event) => event.stopPropagation()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between gap-3">
        <input
          className="flex-1 rounded-xl border border-cream-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-cream-accent"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索应用..."
          value={search}
        />
        <button
          className="rounded-xl border border-cream-border px-4 py-2.5 text-sm text-cream-textPrimary transition hover:bg-cream-surface"
          onClick={onClose}
          type="button"
        >
          收起
        </button>
      </div>

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
        {isLoading ? <div className="py-6 text-center text-sm text-cream-textSecondary">正在加载应用列表...</div> : null}
        {!isLoading && filteredApps.length === 0 ? (
          <div className="py-6 text-center text-sm text-cream-textSecondary">没有匹配的应用，可以在下方手动添加。</div>
        ) : null}
        {filteredApps.map((app) => (
          <AppPickerItem
            app={app}
            key={app.exePath}
            onSelect={(selected) => {
              onAddApp(toAppEntry(selected));
            }}
          />
        ))}
      </div>

      <div className="my-4 border-t border-dashed border-cream-border" />
      <CustomAppForm onAddApp={onAddApp} />
    </div>
  );
}
