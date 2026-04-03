import { useMemo } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { Preset, PresetStatus } from '../types';
import type { useAppList } from '../hooks/useAppList';
import { reorderItems } from '../lib/utils';
import PresetCard from './PresetCard/PresetCard';

interface PresetListProps {
  appListState: ReturnType<typeof useAppList>;
  expandedPresetId: string | null;
  getPresetStatus: (presetId: string) => PresetStatus;
  isLoading: boolean;
  onExpandedPresetChange: (presetId: string | null) => void;
  onRequestConfirm: (payload: { presetId: string; riskyApps: string[] }) => void;
  onReorderPresets: (nextPresets: Preset[]) => Promise<void>;
  onUpdatePreset: (presetId: string, updater: (preset: Preset) => Preset) => Promise<void>;
  presets: Preset[];
}

interface SortablePresetItemProps {
  appListState: ReturnType<typeof useAppList>;
  getPresetStatus: (presetId: string) => PresetStatus;
  isExpanded: boolean;
  onExpandedPresetChange: (presetId: string | null) => void;
  onRequestConfirm: (payload: { presetId: string; riskyApps: string[] }) => void;
  onUpdatePreset: (presetId: string, updater: (preset: Preset) => Preset) => Promise<void>;
  preset: Preset;
}

function SortablePresetItem({
  appListState,
  getPresetStatus,
  isExpanded,
  onExpandedPresetChange,
  onRequestConfirm,
  onUpdatePreset,
  preset,
}: SortablePresetItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: preset.id });

  return (
    <div
      className={isDragging ? 'z-20' : ''}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="mb-4" {...attributes} {...listeners}>
        <PresetCard
          appList={appListState.appList}
          isAppListLoading={appListState.isLoading}
          isExpanded={isExpanded}
          onEnsureAppListLoaded={appListState.ensureLoaded}
          onExpandChange={(nextValue) => onExpandedPresetChange(nextValue ? preset.id : null)}
          onRequestConfirm={onRequestConfirm}
          onUpdatePreset={onUpdatePreset}
          preset={preset}
          status={getPresetStatus(preset.id)}
        />
      </div>
    </div>
  );
}

export default function PresetList({
  appListState,
  expandedPresetId,
  getPresetStatus,
  isLoading,
  onExpandedPresetChange,
  onRequestConfirm,
  onReorderPresets,
  onUpdatePreset,
  presets,
}: PresetListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const presetIds = useMemo(() => presets.map((preset) => preset.id), [presets]);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-cream-textSecondary">正在加载预设...</div>;
  }

  if (presets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-[24px] border border-dashed border-cream-border bg-cream-surface/60 px-6 text-center">
        <h3 className="text-xl font-semibold text-cream-textPrimary">还没有预设</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-cream-textSecondary">
          点击右上角“新建预设”，创建你的第一个启动组合。你可以继续调整应用顺序、预设顺序和运行状态。
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-2">
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          const { active, over } = event;
          if (!over || active.id === over.id) {
            return;
          }

          const oldIndex = presets.findIndex((preset) => preset.id === active.id);
          const newIndex = presets.findIndex((preset) => preset.id === over.id);
          if (oldIndex < 0 || newIndex < 0) {
            return;
          }

          void onReorderPresets(reorderItems(presets, oldIndex, newIndex));
        }}
        sensors={sensors}
      >
        <SortableContext items={presetIds} strategy={verticalListSortingStrategy}>
          {presets.map((preset) => (
            <SortablePresetItem
              appListState={appListState}
              getPresetStatus={getPresetStatus}
              isExpanded={expandedPresetId === preset.id}
              key={preset.id}
              onExpandedPresetChange={onExpandedPresetChange}
              onRequestConfirm={onRequestConfirm}
              onUpdatePreset={onUpdatePreset}
              preset={preset}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
