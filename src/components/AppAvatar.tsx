import { useMemo, useState } from 'react';

import { initialsFromName, toneClass } from '../lib/utils';

interface AppAvatarProps {
  name: string;
  iconPath?: string;
  size: 'sm' | 'lg';
}

export default function AppAvatar({ name, iconPath, size }: AppAvatarProps) {
  const [hasError, setHasError] = useState(false);

  const sizeClass = size === 'lg' ? 'h-16 w-16 rounded-2xl text-lg' : 'h-12 w-12 rounded-xl text-sm';
  const fallbackTone = useMemo(() => toneClass(name), [name]);

  if (iconPath && !hasError) {
    return (
      <div className={`overflow-hidden border border-white/60 bg-white shadow-card ${sizeClass}`}>
        <img
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setHasError(true)}
          src={iconPath}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center border border-white/60 bg-gradient-to-br font-semibold shadow-card ${fallbackTone} ${sizeClass}`}
      title={name}
    >
      {initialsFromName(name)}
    </div>
  );
}
