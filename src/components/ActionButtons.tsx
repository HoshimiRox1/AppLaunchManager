import { useState } from 'react';

interface ActionButtonsProps {
  presetId: string;
  onRequestConfirm: (payload: { presetId: string; riskyApps: string[] }) => void;
}

export default function ActionButtons({ presetId, onRequestConfirm }: ActionButtonsProps) {
  const [isBusy, setIsBusy] = useState(false);

  const handleStart = async () => {
    setIsBusy(true);
    await window.electronAPI.launcherStartPreset(presetId);
    setIsBusy(false);
  };

  const handleStop = async () => {
    setIsBusy(true);
    const result = await window.electronAPI.killerStopPreset(presetId);
    if (result.needsConfirm) {
      onRequestConfirm({ presetId, riskyApps: result.riskyApps });
    }
    setIsBusy(false);
  };

  return (
    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <button
        className="rounded-xl bg-cream-accent px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-hover disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isBusy}
        onClick={() => void handleStart()}
        type="button"
      >
        启动
      </button>
      <button
        className="rounded-xl border border-cream-danger px-4 py-2 text-sm font-semibold text-cream-danger transition hover:bg-cream-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isBusy}
        onClick={() => void handleStop()}
        type="button"
      >
        关闭
      </button>
    </div>
  );
}
