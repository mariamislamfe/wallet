"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PieChart, Plus, Trash2, X } from "lucide-react";

import { Ar } from "@/components/ar";
import { cn, uuid } from "@/lib/client";
import { round2, sanitizeAmountInput, type BudgetUsage, type MonthPlan } from "@/lib/finance";
import { formatMoney, formatNumber } from "@/lib/format";
import { BUDGET_KINDS, type Budget, type BudgetInput, type BudgetKind } from "@/types/finance";

const EASE = [0.22, 1, 0.36, 1] as const;

const PRESETS: Omit<BudgetInput, "id">[] = [
  { name: "Charity", kind: "percent", value: 10 },
  { name: "Savings", kind: "percent", value: 20 },
  { name: "Fun", kind: "fixed", value: 1000 },
  { name: "Bills", kind: "fixed", value: 2000 },
];

function shareLabel(budget: Pick<Budget, "kind" | "value">): string {
  return budget.kind === "percent" ? `${formatNumber(budget.value)}%` : formatMoney(budget.value);
}

type PlanProps = {
  plan: MonthPlan;
  budgets: Budget[];
  income: number;
  onSave: (lines: BudgetInput[]) => Promise<string | null>;
};

export function BudgetPlan({ plan, budgets, income, onSave }: PlanProps) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      {budgets.length === 0 ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-neutral-300 px-4 py-4 text-start transition hover:border-neutral-400 hover:bg-white dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
            <PieChart className="size-4" strokeWidth={1.5} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              Plan your month <Ar className="ms-1 font-normal text-neutral-400">قسّم فلوسك</Ar>
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">10% charity, 20% savings, EGP 1,000 fun…</span>
          </span>
        </button>
      ) : (
        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-neutral-500">
              Plan <span aria-hidden className="mx-1 text-neutral-300 dark:text-neutral-600">·</span>
              <Ar className="font-normal text-neutral-400">التقسيمة</Ar>
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="-me-2 h-8 rounded-full px-3 text-[13px] font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              Edit
            </button>
          </div>

          <ul className="mt-3 space-y-4">
            {plan.lines.map((line) => (
              <PlanLine key={line.budget.id} line={line} hasIncome={income > 0} />
            ))}
          </ul>

          <dl className="mt-4 space-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-neutral-800">
            {income > 0 && (
              <div className="flex justify-between gap-3">
                <dt>{plan.unallocated >= 0 ? "Not planned yet" : "Plan exceeds income by"}</dt>
                <dd className={cn("tabular-nums", plan.unallocated < 0 && "text-red-600 dark:text-red-400")}>
                  {formatMoney(Math.abs(plan.unallocated))}
                </dd>
              </div>
            )}
            {plan.untagged > 0 && (
              <div className="flex justify-between gap-3">
                <dt>Spending without a budget</dt>
                <dd className="tabular-nums">{formatMoney(plan.untagged)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <BudgetEditor
            budgets={budgets}
            income={income}
            onClose={() => setEditing(false)}
            onSave={onSave}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function PlanLine({ line, hasIncome }: { line: BudgetUsage; hasIncome: boolean }) {
  const { budget, allocated, spent } = line;
  const waitingForIncome = budget.kind === "percent" && !hasIncome;
  const share = allocated > 0 ? Math.min(spent / allocated, 1) : spent > 0 ? 1 : 0;
  const over = round2(spent - allocated);

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex min-w-0 items-baseline gap-1.5">
          <bdi className="truncate text-sm font-medium">{budget.name}</bdi>
          <span className="shrink-0 text-xs text-neutral-400 tabular-nums">{shareLabel(budget)}</span>
        </p>
        <p className="shrink-0 text-xs text-neutral-500 tabular-nums">
          {waitingForIncome ? (
            "No income yet"
          ) : over > 0 ? (
            <span className="text-red-600 dark:text-red-400">{formatMoney(over)} over</span>
          ) : (
            `${formatMoney(allocated - spent)} left`
          )}
        </p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out-quint",
            over > 0 ? "bg-red-500" : "bg-neutral-900 dark:bg-neutral-100",
          )}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-neutral-400 tabular-nums">
        {formatMoney(spent)} of {waitingForIncome ? `${formatNumber(budget.value)}% of income` : formatMoney(allocated)}
      </p>
    </li>
  );
}

type Draft = { id: string; name: string; kind: BudgetKind; value: string };

function toDraft(budget: Pick<Budget, "name" | "kind" | "value"> & { id?: string }): Draft {
  return { id: budget.id ?? uuid(), name: budget.name, kind: budget.kind, value: String(budget.value) };
}

function BudgetEditor({
  budgets,
  income,
  onClose,
  onSave,
}: {
  budgets: Budget[];
  income: number;
  onClose: () => void;
  onSave: (lines: BudgetInput[]) => Promise<string | null>;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => budgets.map(toDraft));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const focusLast = useRef(false);

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

  useEffect(() => {
    if (!focusLast.current) return;
    focusLast.current = false;
    list.current?.lastElementChild?.querySelector("input")?.focus();
  }, [drafts.length]);

  const percentTotal = round2(
    drafts.reduce((sum, d) => sum + (d.kind === "percent" ? Number(d.value) || 0 : 0), 0),
  );
  const fixedTotal = round2(drafts.reduce((sum, d) => sum + (d.kind === "fixed" ? Number(d.value) || 0 : 0), 0));
  const planned = round2((income * percentTotal) / 100 + fixedTotal);

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    setError(null);
  }

  function add(preset?: Omit<BudgetInput, "id">) {
    focusLast.current = !preset;
    setDrafts((current) => [
      ...current,
      preset ? toDraft(preset) : { id: uuid(), name: "", kind: "percent", value: "" },
    ]);
    setError(null);
  }

  async function save() {
    const lines: BudgetInput[] = [];
    for (const d of drafts) {
      const name = d.name.trim();
      const value = Number(d.value);
      if (!name && !d.value) continue; // untouched blank row
      if (!name) return setError("Give every line a name.");
      if (!(value > 0)) return setError(`${name}: enter an amount above zero.`);
      if (d.kind === "percent" && value > 100) return setError(`${name}: a share can't pass 100%.`);
      lines.push({ id: d.id, name, kind: d.kind, value: round2(value) });
    }
    setSaving(true);
    const failure = await onSave(lines);
    setSaving(false);
    if (failure) setError(failure);
    else onClose();
  }

  const unusedPresets = PRESETS.filter(
    (p) => !drafts.some((d) => d.name.trim().toLocaleLowerCase() === p.name.toLocaleLowerCase()),
  );

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
        aria-labelledby="plan-editor-title"
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.26, ease: EASE }}
        className="relative flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-3xl border border-neutral-200 bg-white shadow-[0_-12px_40px_-20px_rgba(0,0,0,0.35)] sm:rounded-3xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <div>
            <h2 id="plan-editor-title" className="text-lg font-semibold tracking-tight">
              Monthly plan <Ar className="ms-1 text-base font-normal text-neutral-400">التقسيمة</Ar>
            </h2>
            <p className="text-xs text-neutral-500">% lines are a share of each month&apos;s income.</p>
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

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
          <ul ref={list} className="space-y-3">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40"
              >
                <div className="flex items-center gap-2">
                  <input
                    dir="auto"
                    value={draft.name}
                    maxLength={40}
                    placeholder="Name, e.g. Charity"
                    aria-label="Line name"
                    onChange={(event) => update(draft.id, { name: event.target.value })}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-white px-3 text-base outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 dark:bg-neutral-900 dark:focus:border-neutral-700"
                  />
                  <button
                    type="button"
                    onClick={() => setDrafts((current) => current.filter((d) => d.id !== draft.id))}
                    aria-label={`Remove ${draft.name || "line"}`}
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white hover:text-red-500 dark:hover:bg-neutral-900"
                  >
                    <Trash2 className="size-4" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div
                    role="radiogroup"
                    aria-label="Type"
                    className="grid shrink-0 grid-cols-2 rounded-lg border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    {BUDGET_KINDS.map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        role="radio"
                        aria-checked={draft.kind === kind}
                        onClick={() => update(draft.id, { kind })}
                        className={cn(
                          "h-8 rounded-md px-3 text-[13px] font-medium transition",
                          draft.kind === kind
                            ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                            : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100",
                        )}
                      >
                        {kind === "percent" ? "%" : "EGP"}
                      </button>
                    ))}
                  </div>
                  <label className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-white px-3 dark:bg-neutral-900">
                    <input
                      inputMode="decimal"
                      value={draft.value}
                      placeholder="0"
                      aria-label={draft.kind === "percent" ? "Percent of income" : "Amount in EGP"}
                      onChange={(event) => update(draft.id, { value: sanitizeAmountInput(event.target.value) })}
                      className="min-w-0 flex-1 bg-transparent text-base font-medium tabular-nums outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
                    />
                    <span className="shrink-0 text-sm text-neutral-400">
                      {draft.kind === "percent" ? "of income" : "/ month"}
                    </span>
                  </label>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => add()}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 text-sm font-medium text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            <Plus className="size-4" strokeWidth={1.75} />
            Add line <Ar className="font-normal text-neutral-400">بند جديد</Ar>
          </button>

          {unusedPresets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {unusedPresets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => add(preset)}
                  className="h-8 rounded-full border border-neutral-200 px-3 text-[13px] text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  + {preset.name} {shareLabel(preset)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-neutral-800">
          <p className="text-xs text-neutral-500 tabular-nums">
            {percentTotal > 0 && `${formatNumber(percentTotal)}% of income`}
            {percentTotal > 0 && fixedTotal > 0 && " + "}
            {fixedTotal > 0 && formatMoney(fixedTotal)}
            {(percentTotal > 0 || fixedTotal > 0) && income > 0 && ` = ${formatMoney(planned)} this month`}
            {percentTotal > 100 && <span className="text-red-600 dark:text-red-400"> · over 100%</span>}
          </p>
          <p role="alert" className="mt-1 min-h-4 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-2 flex h-11 w-full items-center justify-center rounded-xl bg-neutral-900 text-sm font-medium text-white transition hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {saving ? "Saving…" : "Save plan"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
