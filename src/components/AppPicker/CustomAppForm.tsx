import { useEffect, useMemo, useRef, useState } from 'react';

import type { AppEntry } from '../../types';
import { createCustomAppEntry, pathBaseName, readFileAsDataUrl } from '../../lib/utils';

interface DraftApp {
  name: string;
  exePath: string;
  installDir: string;
  iconPath: string;
}

interface CustomAppFormProps {
  draftApp: DraftApp | null;
  onAddApp: (appEntry: AppEntry) => void;
  onDraftConsumed: () => void;
}

// 为了把外部传入的草稿安全写入当前表单状态。
function applyDraft(
  draftApp: DraftApp,
  setters: {
    setName: (value: string) => void;
    setExePath: (value: string) => void;
    setInstallDir: (value: string) => void;
    setIconPath: (value: string) => void;
  },
): void {
  setters.setName(draftApp.name);
  setters.setExePath(draftApp.exePath);
  setters.setInstallDir(draftApp.installDir);
  setters.setIconPath(draftApp.iconPath);
}

export default function CustomAppForm({ draftApp, onAddApp, onDraftConsumed }: CustomAppFormProps) {
  const exeInputRef = useRef<HTMLInputElement | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const installDirRequestIdRef = useRef(0);
  const [name, setName] = useState('');
  const [exePath, setExePath] = useState('');
  const [installDir, setInstallDir] = useState('');
  const [iconPath, setIconPath] = useState('');
  const [isInstallDirLoading, setIsInstallDirLoading] = useState(false);

  const previewLabel = useMemo(() => (exePath ? pathBaseName(exePath) : '未选择图标'), [exePath]);

  useEffect(() => {
    if (!draftApp) {
      return;
    }

    applyDraft(draftApp, {
      setName,
      setExePath,
      setInstallDir,
      setIconPath,
    });
  }, [draftApp]);

  // 为了在 exePath 变化后通过主进程重新推导默认监测目录。
  const syncInstallDirFromExePath = async (nextExePath: string) => {
    const trimmedExePath = nextExePath.trim();
    if (!trimmedExePath) {
      setInstallDir('');
      return '';
    }

    const requestId = installDirRequestIdRef.current + 1;
    installDirRequestIdRef.current = requestId;
    setIsInstallDirLoading(true);

    try {
      const nextInstallDir = await window.electronAPI.pathGetDefaultInstallDir(trimmedExePath);
      if (installDirRequestIdRef.current === requestId) {
        setInstallDir(nextInstallDir);
      }
      return nextInstallDir;
    } finally {
      if (installDirRequestIdRef.current === requestId) {
        setIsInstallDirLoading(false);
      }
    }
  };

  // 为了在用户从文件选择器挑选 exe 后立即填充路径与监测目录。
  const handleExeFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    const filePath = (file as File & { path?: string }).path ?? file.name;
    setExePath(filePath);
    await syncInstallDirFromExePath(filePath);
    if (!name) {
      setName(pathBaseName(filePath));
    }
  };

  // 为了在用户上传图标后更新当前表单的图标预览数据。
  const handleIconFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    const nextIcon = await readFileAsDataUrl(file);
    setIconPath(nextIcon);
  };

  // 为了在添加完成后把表单恢复为空白状态。
  const resetForm = () => {
    setName('');
    setExePath('');
    setInstallDir('');
    setIconPath('');
    onDraftConsumed();
  };

  // 为了把当前表单配置转换成真正的应用条目并加入预设。
  const handleSubmit = async () => {
    if (!exePath.trim()) {
      return;
    }

    const resolvedInstallDir = installDir.trim() || (await syncInstallDirFromExePath(exePath));
    onAddApp(
      createCustomAppEntry({
        name,
        exePath,
        installDir: resolvedInstallDir,
        iconPath,
      }),
    );
    resetForm();
  };

  return (
    <div className="rounded-2xl border border-cream-border bg-white/55 p-4">
      <p className="text-sm font-medium text-cream-textPrimary">找不到应用？手动添加</p>
      <div className="mt-4 space-y-3">
        <input
          className="w-full rounded-xl border border-cream-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-cream-accent"
          onChange={(event) => setName(event.target.value)}
          placeholder="应用名称（可选）"
          value={name}
        />
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-cream-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-cream-accent"
            onBlur={() => void syncInstallDirFromExePath(exePath)}
            onChange={(event) => {
              const nextExePath = event.target.value;
              setExePath(nextExePath);
              if (!name.trim()) {
                setName(pathBaseName(nextExePath));
              }
            }}
            placeholder="可执行文件路径"
            value={exePath}
          />
          <button
            className="rounded-xl border border-cream-border px-4 py-2.5 text-sm text-cream-textPrimary transition hover:bg-cream-surface"
            onClick={() => exeInputRef.current?.click()}
            type="button"
          >
            浏览
          </button>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-cream-textPrimary">监测目录</label>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-0 flex-1 rounded-xl border border-cream-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-cream-accent"
              onChange={(event) => setInstallDir(event.target.value)}
              placeholder="监测目录"
              value={installDir}
            />
            <button
              className="rounded-xl border border-cream-border px-4 py-2.5 text-sm text-cream-textPrimary transition hover:bg-cream-surface disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!installDir.trim()}
              onClick={() => {
                void window.electronAPI.pathGetParentDir(installDir).then((nextInstallDir) => setInstallDir(nextInstallDir));
              }}
              type="button"
            >
              ← 上一级
            </button>
            <button
              className="rounded-xl border border-cream-border px-4 py-2.5 text-sm text-cream-textPrimary transition hover:bg-cream-surface disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!exePath.trim() || isInstallDirLoading}
              onClick={() => void syncInstallDirFromExePath(exePath)}
              type="button"
            >
              重置
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-cream-textSecondary">
            监测目录下的所有进程都会被视为此应用的进程。如果无法检测到运行状态，请尝试点击「上一级」
          </p>
        </div>
        <div className="flex min-h-12 items-center justify-center rounded-xl border border-dashed border-cream-border bg-cream-surface/65 px-4 text-sm text-cream-textSecondary">
          将应用文件或快捷方式拖动到此处
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded-xl border border-cream-border px-4 py-2.5 text-sm text-cream-textPrimary transition hover:bg-cream-surface"
            onClick={() => iconInputRef.current?.click()}
            type="button"
          >
            上传图标
          </button>
          <div className="text-sm text-cream-textSecondary">{iconPath ? '图标已选择' : previewLabel}</div>
        </div>
      </div>

      <input
        accept=".exe,.lnk"
        className="hidden"
        onChange={(event) => void handleExeFile(event.target.files?.[0])}
        ref={exeInputRef}
        type="file"
      />
      <input
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleIconFile(event.target.files?.[0])}
        ref={iconInputRef}
        type="file"
      />

      <button
        className="mt-4 rounded-xl bg-cream-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        onClick={() => void handleSubmit()}
        type="button"
      >
        添加到当前预设
      </button>
    </div>
  );
}
