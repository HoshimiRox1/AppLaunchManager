import { useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { AppEntry } from '../types';
import AppAvatar from './AppAvatar';

interface SortableAppGridProps {
  apps: AppEntry[];
  onRemove: (appId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onShowPicker: () => void;
}

interface SortableIconProps {
  appEntry: AppEntry;
  isActionOpen: boolean;
  onOpenAction: (appId: string) => void;
  onRemove: (appId: string) => void;
}

function SortableIcon({ appEntry, isActionOpen, onOpenAction, onRemove }: SortableIconProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: appEntry.id });

  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-2xl p-2 transition ${isDragging ? 'scale-105 shadow-hover' : ''}`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="group flex flex-col items-center gap-2"
        onClick={(event) => {
          event.stopPropagation();
          onOpenAction(appEntry.id);
        }}
        type="button"
        {...attributes}
        {...listeners}
      >
        <div className="transition duration-200 group-hover:scale-105">
          <AppAvatar iconPath={appEntry.iconPath} name={appEntry.name} size="lg" />
        </div>
        <span className="max-w-20 truncate text-sm text-cream-textPrimary">{appEntry.name}</span>
      </button>

      {isActionOpen ? (
        <button
          className="absolute -bottom-3 rounded-full bg-cream-danger px-3 py-1 text-xs font-medium text-white shadow-card"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(appEntry.id);
          }}
          type="button"
        >
          移除
        </button>
      ) : null}
    </div>
  );
}

export default function SortableAppGrid({ apps, onRemove, onReorder, onShowPicker }: SortableAppGridProps) {
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={(event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) {
          return;
        }

        const fromIndex = apps.findIndex((appEntry) => appEntry.id === active.id);
        const toIndex = apps.findIndex((appEntry) => appEntry.id === over.id);
        if (fromIndex < 0 || toIndex < 0) {
          return;
        }

        onReorder(fromIndex, toIndex);
      }}
      sensors={sensors}
    >
      <SortableContext items={apps.map((appEntry) => appEntry.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {apps.map((appEntry) => (
            <SortableIcon
              appEntry={appEntry}
              isActionOpen={activeActionId === appEntry.id}
              key={appEntry.id}
              onOpenAction={(appId) => setActiveActionId((current) => (current === appId ? null : appId))}
              onRemove={onRemove}
            />
          ))}
          <button
            className="flex min-h-[126px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-cream-border bg-white/45 text-sm font-medium text-cream-textSecondary transition hover:border-cream-accent hover:bg-white"
            onClick={(event) => {
              event.stopPropagation();
              setActiveActionId(null);
              onShowPicker();
            }}
            type="button"
          >
            <span className="text-3xl leading-none">+</span>
            添加应用
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}
