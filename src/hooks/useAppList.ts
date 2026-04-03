import { useCallback, useEffect, useRef, useState } from 'react';

import type { ScannedApp } from '../types';

export function useAppList() {
  const [appList, setAppList] = useState<ScannedApp[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const hasLoadedRef = useRef(false);
  const loadingPromiseRef = useRef<Promise<void> | null>(null);

  // 为了在应用启动后预加载应用列表并复用同一个请求。
  const ensureLoaded = useCallback(async () => {
    if (hasLoadedRef.current) {
      return;
    }

    if (loadingPromiseRef.current) {
      await loadingPromiseRef.current;
      return;
    }

    setIsLoading(true);
    const loadingPromise = window.electronAPI
      .appScanInstalled()
      .then((apps) => {
        setAppList(apps);
        setHasLoaded(true);
        hasLoadedRef.current = true;
      })
      .catch(() => {
        setHasLoaded(false);
        hasLoadedRef.current = false;
      })
      .finally(() => {
        loadingPromiseRef.current = null;
        setIsLoading(false);
      });

    loadingPromiseRef.current = loadingPromise;
    await loadingPromise;
  }, []);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  return {
    appList,
    isLoading,
    hasLoaded,
    ensureLoaded,
  };
}
