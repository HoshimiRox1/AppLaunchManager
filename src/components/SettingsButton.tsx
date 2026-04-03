interface SettingsButtonProps {
  onClick: () => void;
}

export default function SettingsButton({ onClick }: SettingsButtonProps) {
  return (
    <button
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-cream-border bg-cream-surface text-cream-textPrimary shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-hover"
      onClick={onClick}
      type="button"
    >
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M10.325 4.317a1 1 0 0 1 1.35-.936l.532.218a1 1 0 0 0 .77 0l.531-.218a1 1 0 0 1 1.351.936v.575a1 1 0 0 0 .293.707l.406.407a1 1 0 0 0 .707.293h.575a1 1 0 0 1 .936 1.35l-.218.532a1 1 0 0 0 0 .77l.218.531a1 1 0 0 1-.936 1.351h-.575a1 1 0 0 0-.707.293l-.406.406a1 1 0 0 0-.293.707v.575a1 1 0 0 1-1.351.936l-.531-.218a1 1 0 0 0-.77 0l-.532.218a1 1 0 0 1-1.35-.936v-.575a1 1 0 0 0-.293-.707l-.407-.406a1 1 0 0 0-.707-.293h-.575a1 1 0 0 1-.936-1.351l.218-.531a1 1 0 0 0 0-.77l-.218-.532a1 1 0 0 1 .936-1.35h.575a1 1 0 0 0 .707-.293l.407-.407a1 1 0 0 0 .293-.707v-.575Z" />
        <path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z" />
      </svg>
    </button>
  );
}
