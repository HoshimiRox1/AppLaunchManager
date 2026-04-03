import { useCallback, useState } from 'react';

import type { ScannedApp } from '../types';

export function useAppList() {
  const [appList, setAppList] = useState<ScannedApp[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const ensureLoaded = useCallback(async () => {
    if (hasLoaded || isLoading) {
      return;
    }

    setIsLoading(true);
    const apps = await window.electronAPI.appScanInstalled();
    setAppList(apps);
    setHasLoaded(true);
    setIsLoading(false);
  }, [hasLoaded, isLoading]);

  return {
    appList,
    isLoading,
    ensureLoaded,
  };
}
