import { useCallback, useEffect, useState } from 'react';

import type { Settings } from '../types';

const defaultSettings: Settings = {
  adminMode: false,
  runInBackground: false,
  launchOnStartup: false,
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void window.electronAPI.settingsGet().then((nextSettings) => {
      if (!isMounted) {
        return;
      }

      setSettings(nextSettings);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      const nextSettings = { ...settings, [key]: value };
      setSettings(nextSettings);
      await window.electronAPI.settingsSave(nextSettings);
    },
    [settings],
  );

  return {
    settings,
    isLoading,
    updateSetting,
  };
}
