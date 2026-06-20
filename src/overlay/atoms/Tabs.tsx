import type { ReactNode } from "react";

export type TabItem<TId extends string> = {
  id: TId;
  /** Visible label. Omit for icon-only tabs (e.g. settings). */
  label?: string;
  icon: ReactNode;
  /** Optional badge count rendered beside the label. */
  count?: string | number;
};

type TabsProps<TId extends string> = {
  items: TabItem<TId>[];
  activeId: TId;
  onChange: (id: TId) => void;
};

/** Horizontal tab bar on the slate strip; the active tab is filled grey. */
export function Tabs<TId extends string>({ items, activeId, onChange }: TabsProps<TId>) {
  return (
    <div data-testid="shopiq-tabs" className="flex items-center justify-between bg-shopiq-tab-bar p-1">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            data-testid={`shopiq-tab-${item.id}`}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 shrink-0 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[10px] transition ${
              active
                ? "bg-shopiq-tab-active font-medium text-white"
                : "text-shopiq-ink hover:bg-shopiq-surface"
            }`}
            onClick={() => onChange(item.id)}
            type="button"
          >
            {item.icon}
            {item.label ? <span className="truncate">{item.label}</span> : null}
            {item.count !== undefined ? (
              <span
                className={`shrink-0 rounded-full px-1 text-[10px] ${
                  active ? "bg-white/25 text-white" : "bg-black/10 text-shopiq-muted"
                }`}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
