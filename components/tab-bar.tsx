"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Briefcase, House, PieChart, ReceiptText, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/client";

export const TABS = ["home", "activity", "pockets", "projects"] as const;
export type Tab = (typeof TABS)[number];

const ITEMS: Record<Tab, { en: string; ar: string; icon: LucideIcon }> = {
  home: { en: "Home", ar: "الرئيسية", icon: House },
  activity: { en: "Activity", ar: "الحركات", icon: ReceiptText },
  pockets: { en: "Pockets", ar: "الجيوب", icon: PieChart },
  projects: { en: "Projects", ar: "المشاريع", icon: Briefcase },
};

const SPRING = { type: "spring", stiffness: 520, damping: 40, mass: 0.8 } as const;

type Props = {
  tab: Tab;
  onChange: (tab: Tab) => void;
  /** Tabs that want attention, e.g. income waiting for a decision. */
  dots?: ReadonlySet<Tab>;
};

/** Floating pill nav: the active tab's highlight slides over and its label unfolds. */
export function TabBar({ tab, onChange, dots }: Props) {
  const reduceMotion = useReducedMotion();
  const spring = reduceMotion ? { duration: 0 } : SPRING;

  return (
    <nav
      aria-label="Sections"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <ul className="pointer-events-auto flex items-center gap-1 rounded-full border border-neutral-200/70 bg-white/80 p-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.28)] backdrop-blur-xl backdrop-saturate-150 dark:border-neutral-800/80 dark:bg-neutral-900/80 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)]">
        {TABS.map((id) => {
          const { en, ar, icon: Icon } = ITEMS[id];
          const active = id === tab;
          return (
            <li key={id}>
              <motion.button
                type="button"
                layout
                transition={spring}
                whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                onClick={() => onChange(id)}
                aria-current={active ? "page" : undefined}
                aria-label={`${en} · ${ar}`}
                className={cn(
                  "relative flex h-11 items-center rounded-full px-3.5 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
                  active
                    ? "text-white dark:text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-highlight"
                    transition={spring}
                    className="absolute inset-0 rounded-full bg-neutral-900 dark:bg-white"
                  />
                )}
                <motion.span layout="position" transition={spring} className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2 : 1.6} />
                  {dots?.has(id) && (
                    <span className="absolute -inset-e-1 -top-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-neutral-900" />
                  )}
                </motion.span>
                <AnimatePresence initial={false}>
                  {active && (
                    <motion.span
                      key="label"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={spring}
                      className="relative overflow-hidden text-[13px] font-semibold whitespace-nowrap"
                    >
                      <span className="block ps-2">{en}</span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
