import type { ScannedApp } from '../../types';
import AppAvatar from '../AppAvatar';

interface AppPickerItemProps {
  app: ScannedApp;
  onSelect: (app: ScannedApp) => void;
}

export default function AppPickerItem({ app, onSelect }: AppPickerItemProps) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-2xl border border-transparent bg-white/65 px-3 py-3 text-left transition hover:border-cream-border hover:bg-white"
      onClick={() => onSelect(app)}
      type="button"
    >
      <AppAvatar iconPath={app.iconPath} name={app.name} size="sm" />
      <div className="min-w-0">
        <div className="truncate font-medium text-cream-textPrimary">{app.name}</div>
        <div className="truncate text-xs text-cream-textSecondary">{app.exePath}</div>
      </div>
    </button>
  );
}
