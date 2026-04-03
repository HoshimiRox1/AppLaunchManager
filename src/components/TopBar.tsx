interface TopBarProps {
  onCreatePreset: () => void;
}

export default function TopBar({ onCreatePreset }: TopBarProps) {
  return (
    <header className="mx-[88px] flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-cream-textSecondary">Workspace Launcher</p>
        <h1 className="mt-2 text-2xl font-semibold text-cream-textPrimary">LaunchManager</h1>
      </div>
      <button
        className="rounded-xl bg-cream-accent px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-hover"
        onClick={onCreatePreset}
        type="button"
      >
        + 新建预设
      </button>
    </header>
  );
}
