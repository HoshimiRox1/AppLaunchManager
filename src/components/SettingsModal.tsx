import Toggle from './Toggle';
import type { Settings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  settings: Settings;
}

const rows: Array<{ key: keyof Settings; title: string; description: string }> = [
  {
    key: 'adminMode',
    title: '管理员模式',
    description: '关闭高风险应用时允许更强的处理逻辑。',
  },
  {
    key: 'runInBackground',
    title: '后台运行',
    description: '关闭窗口时隐藏到后台，而不是直接退出。',
  },
  {
    key: 'launchOnStartup',
    title: '开机自启',
    description: '系统启动后自动打开 LaunchManager。',
  },
];

export default function SettingsModal({ isOpen, onClose, onUpdateSetting, settings }: SettingsModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay fixed inset-0 z-40 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-[28px] border border-cream-border bg-cream-bg p-6 shadow-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-cream-textSecondary">Preferences</p>
            <h2 className="mt-2 text-2xl font-semibold">设置</h2>
          </div>
          <button
            className="rounded-xl border border-cream-border px-3 py-2 text-sm text-cream-textSecondary transition hover:bg-cream-surface"
            onClick={onClose}
            type="button"
          >
            关闭
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {rows.map((row) => (
            <div
              className="flex items-center justify-between gap-4 rounded-2xl border border-cream-border bg-cream-surface px-4 py-4"
              key={row.key}
            >
              <div>
                <p className="font-medium text-cream-textPrimary">{row.title}</p>
                <p className="mt-1 text-sm text-cream-textSecondary">{row.description}</p>
              </div>
              <Toggle
                checked={settings[row.key]}
                onChange={(nextValue) => void onUpdateSetting(row.key, nextValue)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
