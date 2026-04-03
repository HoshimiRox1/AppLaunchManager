interface ConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  riskyApps: string[];
}

export default function ConfirmDialog({ isOpen, onCancel, onConfirm, riskyApps }: ConfirmDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onCancel}>
      <div
        className="w-full max-w-lg rounded-[28px] border border-cream-border bg-cream-bg p-6 shadow-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm uppercase tracking-[0.22em] text-cream-textSecondary">Risk Check</p>
        <h2 className="mt-2 text-2xl font-semibold text-cream-textPrimary">确认关闭这些应用？</h2>
        <p className="mt-3 text-sm leading-6 text-cream-textSecondary">
          以下应用可能存在未保存的内容，确认后会直接标记为关闭状态。
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {riskyApps.map((appName) => (
            <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700" key={appName}>
              {appName}
            </span>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-xl border border-cream-border px-4 py-2.5 text-sm font-medium text-cream-textPrimary transition hover:bg-cream-surface"
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="rounded-xl bg-cream-danger px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            onClick={onConfirm}
            type="button"
          >
            确认关闭
          </button>
        </div>
      </div>
    </div>
  );
}
