import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import type { Preset, PresetStatus } from '../../types';
import ActionButtons from '../ActionButtons';
import StatusBadge from '../StatusBadge';
import AppIconRow from './AppIconRow';

interface PresetCardCollapsedProps {
  dragHandle: ReactNode;
  onDeletePreset: (presetId: string) => Promise<void>;
  onRename: (name: string) => void;
  onRequestConfirm: (payload: { presetId: string; riskyApps: string[] }) => void;
  preset: Preset;
  status: PresetStatus;
}

export default function PresetCardCollapsed({
  dragHandle,
  onDeletePreset,
  onRename,
  onRequestConfirm,
  preset,
  status,
}: PresetCardCollapsedProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(preset.name);

  useEffect(() => {
    if (!isEditing) {
      setDraftName(preset.name);
    }
  }, [isEditing, preset.name]);

  const commitName = () => {
    const nextName = draftName.trim() || '未命名预设';
    onRename(nextName);
    setDraftName(nextName);
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              autoFocus
              className="w-full rounded-xl border border-cream-accent bg-white px-3 py-2 text-lg font-semibold outline-none"
              onBlur={commitName}
              onChange={(event) => setDraftName(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitName();
                }
              }}
              value={draftName}
            />
          ) : (
            <button
              className="max-w-full truncate text-left text-xl font-semibold text-cream-textPrimary"
              onClick={(event) => {
                event.stopPropagation();
                setIsEditing(true);
              }}
              type="button"
            >
              {preset.name}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge runningCount={status.runningCount} status={status.status} totalCount={status.totalCount} />
          <button
            className="rounded-xl border border-cream-border px-3 py-2 text-sm font-medium text-cream-textPrimary transition hover:bg-white"
            onClick={(event) => {
              event.stopPropagation();
              void onDeletePreset(preset.id);
            }}
            type="button"
          >
            删除预设
          </button>
          {dragHandle}
        </div>
      </div>

      <AppIconRow apps={preset.apps} />
      <ActionButtons onRequestConfirm={onRequestConfirm} presetId={preset.id} />
    </div>
  );
}
