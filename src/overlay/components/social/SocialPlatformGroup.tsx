import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type SocialItem = {
  title: string;
  url?: string;
  thumbnailUrl?: string;
  duration?: string;
  topMeta?: ReactNode;
  snippet?: string;
  bottomMeta?: ReactNode;
};

type SocialPlatformGroupProps = {
  icon: ReactNode;
  name: string;
  /** Muted qualifier shown next to the name, e.g. "reviews" for YouTube, "stories" for Reddit. */
  subheading?: string;
  items: SocialItem[];
  defaultOpen?: boolean;
};

const VISIBLE_ITEM_LIMIT = 2;

/** Collapsible group of discussions for a single social platform. */
export function SocialPlatformGroup({
  icon,
  name,
  subheading,
  items,
  defaultOpen = false
}: SocialPlatformGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);

  const visibleItems = showAll ? items : items.slice(0, VISIBLE_ITEM_LIMIT);
  const remainingCount = items.length - visibleItems.length;

  return (
    <div
      data-testid={`shopiq-social-platform-group-${name.toLowerCase()}`}
      className="overflow-hidden rounded-xl border border-shopiq-border bg-shopiq-panel"
      style={{ boxShadow: "var(--shopiq-shadow-card)" }}
    >
      <button
        aria-expanded={open}
        data-testid={`shopiq-social-platform-group-${name.toLowerCase()}-toggle`}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] text-shopiq-brand-strong"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {icon}
        <b className="font-medium">{name}</b>
        {subheading ? (
          <span className="text-[11px] font-normal text-shopiq-faint">· {subheading}</span>
        ) : null}
        <span className="ml-1 rounded-full bg-shopiq-cream-soft px-1.5 text-[10px] text-shopiq-muted">
          {items.length}
        </span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && items.length > 0 ? (
        <div className="flex flex-col">
          {visibleItems.map((item, index) => (
            <a
              key={`${item.title}-${index}`}
              className="flex gap-2 border-t border-shopiq-border px-3 py-2 hover:bg-shopiq-surface"
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              {item.thumbnailUrl ? (
                <div className="relative h-[60px] w-[100px] shrink-0 overflow-hidden rounded-md bg-shopiq-surface">
                  <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  {item.duration ? (
                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[9px] leading-tight text-white">
                      {item.duration}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                {item.topMeta ? <div className="mb-1">{item.topMeta}</div> : null}
                <p className="line-clamp-2 text-xs font-medium leading-snug text-shopiq-ink">{item.title}</p>
                {item.snippet ? (
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-shopiq-body">
                    {item.snippet}
                  </p>
                ) : null}
                {item.bottomMeta ? <div className="mt-1 space-y-0.5">{item.bottomMeta}</div> : null}
              </div>
            </a>
          ))}
          {remainingCount > 0 ? (
            <button
              className="border-t border-shopiq-border px-3 py-2 text-left text-[11px] font-medium text-shopiq-brand-strong hover:bg-shopiq-surface"
              onClick={() => setShowAll(true)}
              type="button"
            >
              Show {remainingCount} more
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
