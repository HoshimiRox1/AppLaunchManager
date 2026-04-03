interface ToggleProps {
  checked: boolean;
  onChange: (nextValue: boolean) => void;
}

export default function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      aria-checked={checked}
      className={`relative inline-flex h-8 w-14 items-center rounded-full border transition duration-200 ${
        checked ? 'border-cream-accent bg-cream-accent' : 'border-cream-border bg-cream-border/70'
      }`}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={`ml-1 inline-block h-6 w-6 rounded-full bg-white shadow transition duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
