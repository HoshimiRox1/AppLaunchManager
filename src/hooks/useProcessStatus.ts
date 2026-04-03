import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AppStatus, Preset, PresetStatus } from '../types';

// 为了把 app 级运行状态聚合成当前 UI 需要的 preset 级状态。
export function useProcessStatus(presets: Preset[]) {
  const [statusMap, setStatusMap] = useState<Map<string, AppStatus>>(new Map());

  useEffect(() => {
    let isMounted = true;

    void window.electronAPI
      .getCurrentStatuses()
      .then((statuses) => {
        if (!isMounted) {
          return;
        }

        setStatusMap(new Map(statuses.map((item) => [item.appId, item])));
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setStatusMap(new Map());
      });

    const unsubscribe = window.electronAPI.onStatusUpdate((statuses) => {
      setStatusMap(new Map(statuses.map((item) => [item.appId, item])));
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const getPresetStatus = useCallback(
    (presetId: string): PresetStatus => {
      const preset = presets.find((item) => item.id === presetId);
      if (!preset) {
        return {
          presetId,
          runningCount: 0,
          totalCount: 0,
          status: 'stopped',
        };
      }

      const runningCount = preset.apps.filter((appEntry) => statusMap.get(appEntry.id)?.isRunning).length;
      const totalCount = preset.apps.length;

      if (runningCount === 0) {
        return {
          presetId,
          runningCount,
          totalCount,
          status: 'stopped',
        };
      }

      if (runningCount === totalCount) {
        return {
          presetId,
          runningCount,
          totalCount,
          status: 'running',
        };
      }

      return {
        presetId,
        runningCount,
        totalCount,
        status: 'partial',
      };
    },
    [presets, statusMap],
  );

  return useMemo(
    () => ({
      statusMap,
      getPresetStatus,
    }),
    [getPresetStatus, statusMap],
  );
}
