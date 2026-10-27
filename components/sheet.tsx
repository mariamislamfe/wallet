"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

import { Ar } from "@/components/ar";

const EASE = [0.22, 1, 0.36, 1] as const;

type Props = {
  id: string;
  title: string;
  titleAr: string;
  subtitle?: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
};

/** Bottom sheet on phones, centred dialog on wider screens. Render inside <AnimatePresence>. */
export function Sheet({ id, title, titleAr, subtitle, onClose, footer, children }: Props) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.26, ease: EASE }}
        className="relative flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-3xl border border-neutral-200 bg-white shadow-[0_-12px_40px_-20px_rgba(0,0,0,0.35)] sm:rounded-3xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <div>
            <h2 id={id} className="text-lg font-semibold tracking-tight">
              {title} <Ar className="ms-1 text-base font-normal text-neutral-400">{titleAr}</Ar>
            </h2>
            {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-me-2 flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>

        <div className="border-t border-neutral-100 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-neutral-800">
          {footer}
        </div>
      </motion.div>
    </div>
  );
}
