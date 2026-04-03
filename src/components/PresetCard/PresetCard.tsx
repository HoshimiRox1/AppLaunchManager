import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import type { Preset, PresetStatus, ScannedApp } from '../../types';
import PresetCardCollapsed from './PresetCardCollapsed';
import PresetCardExpanded from './PresetCardExpanded';

interface PresetCardProps {
  appList: ScannedApp[];
  dragHandle: ReactNode;
  isAppListLoading: boolean;
  isExpanded: boolean;
  onDeletePreset: (presetId: string) => Promise<void>;
  onEnsureAppListLoaded: () => Promise<void>;
  onExpandChange: (nextValue: boolean) => void;
  onRequestConfirm: (payload: { presetId: string; riskyApps: string[] }) => void;
  onUpdatePreset: (presetId: string, updater: (preset: Preset) => Preset) => Promise<void>;
  preset: Preset;
  status: PresetStatus;
}

export default function PresetCard({
  appList,
  dragHandle,
  isAppListLoading,
  isExpanded,
  onDeletePreset,
  onEnsureAppListLoaded,
  onExpandChange,
  onRequestConfirm,
  onUpdatePreset,
  preset,
  status,
}: PresetCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) {
        onExpandChange(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExpandChange(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded, onExpandChange]);

  return (
    <div
      className={`card-panel rounded-[26px] border border-cream-border p-5 transition duration-200 ${
        isExpanded ? 'shadow-hover' : 'hover:-translate-y-0.5 hover:bg-cream-hover hover:shadow-hover'
      }`}
      onClick={() => {
        if (!isExpanded) {
          onExpandChange(true);
        }
      }}
      ref={cardRef}
    >
      {isExpanded ? (
        <PresetCardExpanded
          appList={appList}
          isAppListLoading={isAppListLoading}
          onEnsureAppListLoaded={onEnsureAppListLoaded}
          onExpandChange={onExpandChange}
          onUpdatePreset={onUpdatePreset}
          preset={preset}
          status={status}
        />
      ) : (
        <PresetCardCollapsed
          dragHandle={dragHandle}
          onDeletePreset={onDeletePreset}
          onRequestConfirm={onRequestConfirm}
          onRename={(name) => void onUpdatePreset(preset.id, (current) => ({ ...current, name }))}
          preset={preset}
          status={status}
        />
      )}
    </div>
  );
}
