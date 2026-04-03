import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PresetStatus } from '../types';

export function useProcessStatus() {
  const [statusMap, setStatusMap] = useState<Map<string, PresetStatus>>(new Map());

  useEffect(() => {
    let isMounted = true;

    void window.electronAPI.getCurrentStatuses().then((statuses) => {
      if (!isMounted) {
        return;
      }

      setStatusMap(new Map(statuses.map((item) => [item.presetId, item])));
    });

    const unsubscribe = window.electronAPI.onStatusUpdate((statuses) => {
      setStatusMap(new Map(statuses.map((item) => [item.presetId, item])));
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const getPresetStatus = useCallback(
    (presetId: string): PresetStatus =>
      statusMap.get(presetId) ?? {
        presetId,
        runningCount: 0,
        totalCount: 0,
        status: 'stopped',
      },
    [statusMap],
  );

  return useMemo(
    () => ({
      statusMap,
      getPresetStatus,
    }),
    [getPresetStatus, statusMap],
  );
}
