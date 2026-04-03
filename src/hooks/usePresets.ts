import { useCallback, useEffect, useState } from 'react';

import type { Preset } from '../types';
import { normalizePresetOrders } from '../lib/utils';

interface UsePresetsResult {
  presets: Preset[];
  isLoading: boolean;
  createPreset: () => Promise<string>;
  updatePreset: (presetId: string, updater: (preset: Preset) => Preset) => Promise<void>;
  deletePreset: (presetId: string) => Promise<void>;
  reorderPresets: (nextPresets: Preset[]) => Promise<void>;
}

export function usePresets(): UsePresetsResult {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void window.electronAPI.presetGetAll().then((items) => {
      if (!isMounted) {
        return;
      }

      setPresets(normalizePresetOrders(items));
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const saveNext = useCallback(async (nextPresets: Preset[]) => {
    const normalized = normalizePresetOrders(nextPresets);
    setPresets(normalized);
    await window.electronAPI.presetSave(normalized);
  }, []);

  const createPreset = useCallback(async () => {
    const presetId = crypto.randomUUID();
    const nextPreset: Preset = {
      id: presetId,
      name: '新建预设',
      order: presets.length,
      apps: [],
    };

    await saveNext([...presets, nextPreset]);
    return presetId;
  }, [presets, saveNext]);

  const updatePreset = useCallback(
    async (presetId: string, updater: (preset: Preset) => Preset) => {
      await saveNext(
        presets.map((preset) => (preset.id === presetId ? { ...updater(preset), id: presetId } : preset)),
      );
    },
    [presets, saveNext],
  );

  const deletePreset = useCallback(
    async (presetId: string) => {
      await saveNext(presets.filter((preset) => preset.id !== presetId));
    },
    [presets, saveNext],
  );

  const reorderPresets = useCallback(
    async (nextPresets: Preset[]) => {
      await saveNext(nextPresets);
    },
    [saveNext],
  );

  return {
    presets,
    isLoading,
    createPreset,
    updatePreset,
    deletePreset,
    reorderPresets,
  };
}
