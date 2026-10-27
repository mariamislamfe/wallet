"use client";

import { Briefcase, House, PieChart, ReceiptText, type LucideIcon } from "lucide-react";

import { Ar } from "@/components/ar";
import { cn } from "@/lib/client";

export const TABS = ["home", "activity", "pockets", "projects"] as const;
export type Tab = (typeof TABS)[number];

const ITEMS: Record<Tab, { en: string; ar: string; icon: LucideIcon }> = {
  home: { en: "Home", ar: "الرئيسية", icon: House },
  activity: { en: "Activity", ar: "الحركات", icon: ReceiptText },
  pockets: { en: "Pockets", ar: "الجيوب", icon: PieChart },
  projects: { en: "Projects", ar: "المشاريع", icon: Briefcase },
};

type Props = {
  tab: Tab;
  onChange: (tab: Tab) => void;
  /** Tabs that want attention, e.g. income waiting for a decision. */
  dots?: ReadonlySet<Tab>;
};

export function TabBar({ tab, onChange, dots }: Props) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200/80 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-neutral-800/80 dark:bg-neutral-950/85"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map((id) => {
          const { en, ar, icon: Icon } = ITEMS[id];
          const active = id === tab;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 w-full flex-col items-center justify-center gap-0.5 transition active:scale-95",
                  active
                    ? "text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2 : 1.5} />
                  {dots?.has(id) && (
                    <span className="absolute -inset-e-1 -top-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-neutral-950" />
                  )}
                </span>
                <span className="text-[11px] leading-tight font-medium">{en}</span>
                <Ar className="text-[10px] leading-tight opacity-70">{ar}</Ar>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
