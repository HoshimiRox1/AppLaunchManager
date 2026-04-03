import { useState } from 'react';

import type { AppEntry, Preset, PresetStatus, ScannedApp } from '../../types';
import { ensurePresetHasApp, reorderItems } from '../../lib/utils';
import AppPicker from '../AppPicker/AppPicker';
import SortableAppGrid from '../SortableAppGrid';
import StatusBadge from '../StatusBadge';

interface PresetCardExpandedProps {
  appList: ScannedApp[];
  isAppListLoading: boolean;
  onEnsureAppListLoaded: () => Promise<void>;
  onExpandChange: (nextValue: boolean) => void;
  onUpdatePreset: (presetId: string, updater: (preset: Preset) => Preset) => Promise<void>;
  preset: Preset;
  status: PresetStatus;
}

export default function PresetCardExpanded({
  appList,
  isAppListLoading,
  onEnsureAppListLoaded,
  onExpandChange,
  onUpdatePreset,
  preset,
  status,
}: PresetCardExpandedProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(preset.apps.length === 0);
  const [initialPreset] = useState<Preset>(() => structuredClone(preset));

  const updateApps = (updater: (apps: AppEntry[]) => AppEntry[]) =>
    onUpdatePreset(preset.id, (current) => ({
      ...current,
      apps: updater(current.apps),
    }));

  const addApp = (appEntry: AppEntry) => {
    if (ensurePresetHasApp(preset, appEntry.id) || preset.apps.some((item) => item.exePath === appEntry.exePath)) {
      return;
    }

    void updateApps((apps) => [...apps, appEntry]);
    setIsPickerOpen(false);
  };

  const handleCancel = async () => {
    await onUpdatePreset(preset.id, () => structuredClone(initialPreset));
    onExpandChange(false);
  };

  return (
    <div className="space-y-5" onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <input
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-cream-border bg-white px-3 py-2.5 text-xl font-semibold outline-none transition focus:border-cream-accent"
            onChange={(event) => void onUpdatePreset(preset.id, (current) => ({ ...current, name: event.target.value }))}
            value={preset.name}
          />
          <StatusBadge runningCount={status.runningCount} status={status.status} totalCount={status.totalCount} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="rounded-xl border border-cream-border px-4 py-2.5 text-sm text-cream-textPrimary transition hover:bg-white"
            onClick={() => void handleCancel()}
            type="button"
          >
            取消
          </button>
          <button
            className="rounded-xl border border-cream-border px-4 py-2.5 text-sm text-cream-textPrimary transition hover:bg-white"
            onClick={() => onExpandChange(false)}
            type="button"
          >
            完成
          </button>
        </div>
      </div>

      <SortableAppGrid
        apps={preset.apps}
        onRemove={(appId) => void updateApps((apps) => apps.filter((item) => item.id !== appId))}
        onReorder={(fromIndex, toIndex) => void updateApps((apps) => reorderItems(apps, fromIndex, toIndex))}
        onShowPicker={() => setIsPickerOpen((current) => !current)}
      />

      {isPickerOpen ? (
        <AppPicker
          appList={appList}
          isLoading={isAppListLoading}
          onAddApp={addApp}
          onClose={() => setIsPickerOpen(false)}
          onEnsureLoaded={onEnsureAppListLoaded}
          preset={preset}
        />
      ) : null}
    </div>
  );
}
