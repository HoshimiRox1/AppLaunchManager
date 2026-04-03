import { useMemo, useState } from 'react';

import TopBar from './components/TopBar';
import PresetList from './components/PresetList';
import SettingsButton from './components/SettingsButton';
import SettingsModal from './components/SettingsModal';
import ConfirmDialog from './components/ConfirmDialog';
import { useAppList } from './hooks/useAppList';
import { usePresets } from './hooks/usePresets';
import { useProcessStatus } from './hooks/useProcessStatus';
import { useSettings } from './hooks/useSettings';

interface ConfirmState {
  presetId: string;
  riskyApps: string[];
}

export default function App() {
  const { presets, isLoading, createPreset, updatePreset, deletePreset, reorderPresets } = usePresets();
  const { getPresetStatus } = useProcessStatus(presets);
  const { settings, updateSetting } = useSettings();
  const appListState = useAppList();

  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const sortedPresets = useMemo(() => presets.slice().sort((left, right) => left.order - right.order), [presets]);

  const handleCreatePreset = async () => {
    const presetId = await createPreset();
    setExpandedPresetId(presetId);
  };

  const handleDeletePreset = async (presetId: string) => {
    await deletePreset(presetId);
    setExpandedPresetId((current) => (current === presetId ? null : current));
  };

  const handleConfirmClose = async () => {
    if (!confirmState) {
      return;
    }

    await window.electronAPI.killerConfirmStop(confirmState.presetId);
    setConfirmState(null);
  };

  return (
    <div className="min-h-screen bg-cream-bg text-cream-textPrimary">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-6 pb-0 pt-6 sm:px-8">
        <TopBar onCreatePreset={handleCreatePreset} />
        <main className="mx-[88px] mt-6 flex-1 overflow-hidden rounded-t-[28px] border-x border-t border-cream-border/70 bg-white/30 p-3 shadow-card">
          <PresetList
            appListState={appListState}
            expandedPresetId={expandedPresetId}
            getPresetStatus={getPresetStatus}
            isLoading={isLoading}
            onDeletePreset={handleDeletePreset}
            onExpandedPresetChange={setExpandedPresetId}
            onRequestConfirm={setConfirmState}
            onReorderPresets={reorderPresets}
            onUpdatePreset={updatePreset}
            presets={sortedPresets}
          />
        </main>
      </div>

      <SettingsButton onClick={() => setSettingsOpen(true)} />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onUpdateSetting={updateSetting}
        settings={settings}
      />
      <ConfirmDialog
        isOpen={Boolean(confirmState)}
        onCancel={() => setConfirmState(null)}
        onConfirm={handleConfirmClose}
        riskyApps={confirmState?.riskyApps ?? []}
      />
    </div>
  );
}
