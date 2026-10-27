"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import type { Transaction } from "@/types/finance";

export type ToastState = {
  id: number;
  message: string;
  tone: "neutral" | "error";
  undo?: Transaction;
};

type Props = {
  toast: ToastState | null;
  onDismiss: () => void;
  onUndo: (tx: Transaction) => void;
};

export function Toast({ toast, onDismiss, onUndo }: Props) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, toast.undo ? 5000 : 3500);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)]"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto flex h-11 items-center gap-3 rounded-full bg-neutral-900 ps-4 pe-1.5 text-sm text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)] dark:bg-neutral-100 dark:text-neutral-900"
          >
            {toast.tone === "error" && <span aria-hidden className="size-1.5 rounded-full bg-red-400 dark:bg-red-500" />}
            <span>{toast.message}</span>
            {toast.undo ? (
              <button
                type="button"
                onClick={() => toast.undo && onUndo(toast.undo)}
                className="h-8 rounded-full bg-white/10 px-3.5 font-medium transition hover:bg-white/20 dark:bg-neutral-900/10 dark:hover:bg-neutral-900/20"
              >
                Undo
              </button>
            ) : (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="flex size-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white dark:text-neutral-900/50 dark:hover:bg-neutral-900/10 dark:hover:text-neutral-900"
              >
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
