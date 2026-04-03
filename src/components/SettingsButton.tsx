interface SettingsButtonProps {
  onClick: () => void;
}

export default function SettingsButton({ onClick }: SettingsButtonProps) {
  return (
    <button
      aria-label="打开设置"
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-cream-border bg-cream-surface text-cream-textPrimary shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-hover"
      onClick={onClick}
      type="button"
    >
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M10.63 3.51c.52-1.35 2.22-1.35 2.74 0l.22.59c.2.51.77.77 1.29.63l.61-.16c1.4-.37 2.6.83 2.23 2.23l-.16.61c-.14.52.12 1.09.63 1.29l.59.22c1.35.52 1.35 2.22 0 2.74l-.59.22c-.51.2-.77.77-.63 1.29l.16.61c.37 1.4-.83 2.6-2.23 2.23l-.61-.16c-.52-.14-1.09.12-1.29.63l-.22.59c-.52 1.35-2.22 1.35-2.74 0l-.22-.59c-.2-.51-.77-.77-1.29-.63l-.61.16c-1.4.37-2.6-.83-2.23-2.23l.16-.61c.14-.52-.12-1.09-.63-1.29l-.59-.22c-1.35-.52-1.35-2.22 0-2.74l.59-.22c.51-.2.77-.77.63-1.29l-.16-.61c-.37-1.4.83-2.6 2.23-2.23l.61.16c.52.14 1.09-.12 1.29-.63l.22-.59Z" />
        <circle cx="12" cy="12" r="3.25" />
      </svg>
    </button>
  );
}
