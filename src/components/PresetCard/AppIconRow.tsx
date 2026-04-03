import type { AppEntry } from '../../types';
import AppAvatar from '../AppAvatar';

interface AppIconRowProps {
  apps: AppEntry[];
}

export default function AppIconRow({ apps }: AppIconRowProps) {
  const visibleApps = apps.slice(0, 5);
  const hiddenCount = Math.max(apps.length - visibleApps.length, 0);

  return (
    <div className="flex items-center gap-2 overflow-hidden" onClick={(event) => event.stopPropagation()}>
      {visibleApps.map((appEntry) => (
        <AppAvatar iconPath={appEntry.iconPath} key={appEntry.id} name={appEntry.name} size="sm" />
      ))}
      {hiddenCount > 0 ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-cream-border bg-white/50 text-xs font-semibold text-cream-textSecondary">
          +{hiddenCount}
        </div>
      ) : null}
      {apps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cream-border px-4 py-3 text-sm text-cream-textSecondary">
          暂无应用
        </div>
      ) : null}
    </div>
  );
}
