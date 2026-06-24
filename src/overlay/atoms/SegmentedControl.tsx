type SegmentedOption<T extends string> = { id: T; label: string };

type SegmentedControlProps<T extends string> = {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Base test id; each option button is `${testId}-${option.id}`. */
  testId: string;
};

/** A labelled row of mutually-exclusive pill buttons (single-select), e.g. a sort or star-rating filter. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  testId
}: SegmentedControlProps<T>) {
  return (
    <div className="mb-2.5">
      {label ? (
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-shopiq-muted">{label}</p>
      ) : null}
      <div className="flex gap-1 rounded-lg bg-shopiq-cream-soft p-1">
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              data-testid={`${testId}-${option.id}`}
              className={`flex-1 rounded-md px-1 py-1.5 text-[11px] transition ${
                active ? "bg-shopiq-brand font-medium text-white" : "text-shopiq-muted hover:text-shopiq-ink"
              }`}
              onClick={() => onChange(option.id)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
