type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  testId?: string;
};

export function Switch({ checked, onChange, label, testId }: SwitchProps) {
  return (
    <label data-testid={testId} className="flex items-center justify-between gap-3 text-xs text-shopiq-ink">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
          checked ? "bg-shopiq-brand" : "bg-shopiq-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
