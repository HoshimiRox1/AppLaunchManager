import { useMemo, useRef, useState } from 'react';

import type { AppEntry } from '../../types';
import { createCustomAppEntry, pathBaseName, readFileAsDataUrl } from '../../lib/utils';

interface CustomAppFormProps {
  onAddApp: (appEntry: AppEntry) => void;
}

export default function CustomAppForm({ onAddApp }: CustomAppFormProps) {
  const exeInputRef = useRef<HTMLInputElement | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [exePath, setExePath] = useState('');
  const [iconPath, setIconPath] = useState('');

  const previewLabel = useMemo(() => (exePath ? pathBaseName(exePath) : '未选择图标'), [exePath]);

  const handleExeFile = (file: File | undefined) => {
    if (!file) {
      return;
    }

    const filePath = (file as File & { path?: string }).path ?? file.name;
    setExePath(filePath);
    if (!name) {
      setName(pathBaseName(filePath));
    }
  };

  const handleIconFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    const nextIcon = await readFileAsDataUrl(file);
    setIconPath(nextIcon);
  };

  const handleSubmit = () => {
    if (!exePath.trim()) {
      return;
    }

    onAddApp(createCustomAppEntry({ name, exePath, iconPath }));
    setName('');
    setExePath('');
    setIconPath('');
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
            onChange={(event) => setExePath(event.target.value)}
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
        onChange={(event) => handleExeFile(event.target.files?.[0])}
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
        onClick={handleSubmit}
        type="button"
      >
        添加到当前预设
      </button>
    </div>
  );
}
