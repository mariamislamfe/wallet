"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, Banknote, ChevronLeft, CornerDownLeft, CreditCard } from "lucide-react";

import { Ar } from "@/components/ar";
import { cn, hasFinePointer, uuid } from "@/lib/client";
import {
  TYPE_LABELS,
  WALLET_LABELS,
  buildSuggestions,
  parseAmount,
  rememberedBudget,
  sanitizeAmountInput,
} from "@/lib/finance";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  TRANSACTION_TYPES,
  WALLET_TYPES,
  type Balances,
  type Budget,
  type NewTransaction,
  type Transaction,
  type TransactionType,
  type WalletType,
} from "@/types/finance";

type Step = 0 | 1 | 2;

type Props = {
  balances: Balances;
  transactions: Transaction[];
  budgets: Budget[];
  onSubmit: (input: NewTransaction) => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const QUESTIONS: Record<TransactionType, { en: string; ar: string }> = {
  expense: { en: "On what?", ar: "في إيه؟" },
  income: { en: "From what?", ar: "من إيه؟" },
};

const PLACEHOLDERS: Record<TransactionType, string> = {
  expense: "Coffee, groceries, Uber…",
  income: "Salary, freelance…",
};

/** "12500.5" → "12,500.5" while preserving a trailing dot or partial decimals. */
function displayAmount(text: string): string {
  if (!text) return "";
  const [whole = "", decimals] = text.split(".");
  const grouped = whole ? formatNumber(Number(whole), 0) : "0";
  return decimals === undefined ? grouped : `${grouped}.${decimals}`;
}

export function QuickEntry({ balances, transactions, budgets, onSubmit }: Props) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<Step>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [type, setType] = useState<TransactionType>("expense");
  const [amountText, setAmountText] = useState("");
  const [wallet, setWallet] = useState<WalletType>(() => transactions[0]?.wallet_type ?? "cash");
  const [description, setDescription] = useState("");
  // `undefined` until the user picks a line; until then it follows the description.
  const [pickedBudget, setPickedBudget] = useState<string | null | undefined>(undefined);

  // Whether the step being mounted should take focus.
  const focusNext = useRef(false);
  // iOS only opens the keyboard for focus() inside a user gesture. Focusing this
  // proxy synchronously in the handler keeps the keyboard up until the next
  // step's input mounts and takes focus over.
  const keyboardProxy = useRef<HTMLInputElement>(null);

  const amount = parseAmount(amountText);
  const suggestions = useMemo(
    () => buildSuggestions(transactions, type, description),
    [transactions, type, description],
  );

  function go(next: Step) {
    focusNext.current = true;
    if (next !== 1) keyboardProxy.current?.focus({ preventScroll: true });
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  const budgetFor = (text: string) =>
    type !== "expense"
      ? null
      : pickedBudget !== undefined
        ? pickedBudget
        : rememberedBudget(transactions, budgets, text);

  function submit(text = description) {
    if (amount === null) {
      go(0);
      return;
    }
    onSubmit({
      id: uuid(),
      amount,
      type,
      wallet_type: wallet,
      description: text.trim().slice(0, 120),
      budget_id: budgetFor(text),
    });

    // On desktop keep the cursor in the amount field for rapid entry; on touch
    // let the keyboard drop so the updated balance and feed are visible.
    focusNext.current = hasFinePointer();
    if (focusNext.current) keyboardProxy.current?.focus({ preventScroll: true });
    setAmountText("");
    setDescription("");
    setPickedBudget(undefined);
    setType("expense");
    setDirection(-1);
    setStep(0);
  }

  const offset = reduceMotion ? 0 : 20;
  const variants: Variants = {
    enter: (d: number) => ({ opacity: 0, x: d * offset }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d * -offset }),
  };

  return (
    <section
      aria-label="New transaction"
      className="relative mt-8 overflow-hidden rounded-3xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
    >
      <input
        ref={keyboardProxy}
        aria-hidden
        tabIndex={-1}
        autoComplete="off"
        className="pointer-events-none absolute top-0 left-0 size-px text-base opacity-0"
      />

      <div className="flex h-12 items-center justify-between px-3">
        {step === 0 ? (
          <p className="px-2 text-[13px] font-medium text-neutral-500">
            New entry <span aria-hidden className="mx-1 text-neutral-300 dark:text-neutral-600">·</span>
            <Ar className="font-normal text-neutral-400">حركة جديدة</Ar>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => go((step - 1) as Step)}
            className="flex h-8 items-center gap-0.5 rounded-full pe-3 ps-1.5 text-[13px] font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
            Back
          </button>
        )}
        <StepDots step={step} />
      </div>

      <div className="relative min-h-[232px] px-5 pb-5">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.24, ease: EASE }}
          >
            {step === 0 && (
              <AmountStep
                type={type}
                amountText={amountText}
                canContinue={amount !== null}
                autoFocus={focusNext.current}
                onTypeChange={setType}
                onAmountChange={(raw) => setAmountText(sanitizeAmountInput(raw))}
                onContinue={() => amount !== null && go(1)}
              />
            )}
            {step === 1 && amount !== null && (
              <WalletStep
                type={type}
                amount={amount}
                wallet={wallet}
                balances={balances}
                onEditAmount={() => go(0)}
                onHighlight={setWallet}
                onPick={(picked) => {
                  setWallet(picked);
                  go(2);
                }}
              />
            )}
            {step === 2 && amount !== null && (
              <DescriptionStep
                type={type}
                amount={amount}
                wallet={wallet}
                description={description}
                suggestions={suggestions}
                budgets={type === "expense" ? budgets : []}
                budgetId={budgetFor(description)}
                onBudgetChange={setPickedBudget}
                autoFocus={focusNext.current}
                onEditAmount={() => go(0)}
                onDescriptionChange={setDescription}
                onBack={() => go(1)}
                onSubmit={submit}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-1 px-2" aria-label={`Step ${step + 1} of 3`} role="img">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1 rounded-full transition-all duration-300 ease-out-quint",
            i === step
              ? "w-4 bg-neutral-900 dark:bg-neutral-100"
              : "w-1 bg-neutral-300 dark:bg-neutral-700",
          )}
        />
      ))}
    </div>
  );
}

function AmountStep({
  type,
  amountText,
  canContinue,
  autoFocus,
  onTypeChange,
  onAmountChange,
  onContinue,
}: {
  type: TransactionType;
  amountText: string;
  canContinue: boolean;
  autoFocus: boolean;
  onTypeChange: (type: TransactionType) => void;
  onAmountChange: (raw: string) => void;
  onContinue: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = displayAmount(amountText);
  const length = Math.max(1, shown.length);

  useEffect(() => {
    if (autoFocus || hasFinePointer()) inputRef.current?.focus({ preventScroll: true });
    // Focus once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center pt-2">
      <div
        role="radiogroup"
        aria-label="Transaction type"
        className="relative grid grid-cols-2 rounded-full border border-neutral-200 bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-800/60"
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-out-quint dark:bg-neutral-700",
            type === "income" && "translate-x-full",
          )}
        />
        {TRANSACTION_TYPES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={type === option}
            onClick={() => onTypeChange(option)}
            className={cn(
              "relative flex h-8 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors",
              type === option
                ? "text-neutral-900 dark:text-white"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
            )}
          >
            {TYPE_LABELS[option].en}
            <Ar className="text-[12px] font-normal opacity-60">{TYPE_LABELS[option].ar}</Ar>
          </button>
        ))}
      </div>

      <label className="mt-8 flex w-full items-baseline justify-center gap-2" htmlFor="amount">
        <span className="text-lg font-medium text-neutral-400">EGP</span>
        <input
          ref={inputRef}
          id="amount"
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          placeholder="0"
          aria-label="Amount"
          value={shown}
          onChange={(event) => onAmountChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onContinue();
            } else if (event.key === "+" || event.key === "-") {
              event.preventDefault();
              onTypeChange(event.key === "+" ? "income" : "expense");
            }
          }}
          style={{ width: `calc(${length}ch + 0.08em)` }}
          className={cn(
            "max-w-[80%] bg-transparent font-semibold tracking-[-0.04em] tabular-nums outline-none transition-colors placeholder:text-neutral-300 dark:placeholder:text-neutral-700",
            length > 9 ? "text-4xl" : length > 6 ? "text-5xl" : "text-6xl",
            type === "income" && "text-emerald-600 dark:text-emerald-400",
          )}
        />
      </label>

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="mt-8 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 text-sm font-medium text-white transition hover:bg-neutral-800 active:scale-[0.99] disabled:bg-neutral-100 disabled:text-neutral-400 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
      >
        Continue
        <ArrowRight className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function Summary({
  type,
  amount,
  wallet,
  onEditAmount,
}: {
  type: TransactionType;
  amount: number;
  wallet?: WalletType;
  onEditAmount: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[13px] text-neutral-500">
      <button
        type="button"
        onClick={onEditAmount}
        className={cn(
          "rounded-md font-medium tabular-nums underline-offset-4 hover:underline",
          type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-neutral-100",
        )}
      >
        {type === "income" ? "+" : "−"} {formatMoney(amount)}
      </button>
      <span>{TYPE_LABELS[type].en.toLowerCase()}</span>
      {wallet && (
        <>
          <span aria-hidden>·</span>
          <span>{WALLET_LABELS[wallet].en}</span>
        </>
      )}
    </div>
  );
}

function Question({ en, ar }: { en: string; ar: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
      <h3 className="text-xl font-semibold tracking-tight">{en}</h3>
      <Ar className="text-base text-neutral-400">{ar}</Ar>
    </div>
  );
}

function WalletStep({
  type,
  amount,
  wallet,
  balances,
  onEditAmount,
  onHighlight,
  onPick,
}: {
  type: TransactionType;
  amount: number;
  wallet: WalletType;
  balances: Balances;
  onEditAmount: () => void;
  onHighlight: (wallet: WalletType) => void;
  onPick: (wallet: WalletType) => void;
}) {
  const buttons = useRef<Partial<Record<WalletType, HTMLButtonElement | null>>>({});

  useEffect(() => {
    buttons.current[wallet]?.focus({ preventScroll: true });
    // Focus the remembered wallet once on mount; Enter then confirms it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKeyDown(event: React.KeyboardEvent) {
    const key = event.key.toLowerCase();
    const handled = ["c", "1", "v", "2", "escape", "backspace", "arrowleft", "arrowright"];
    if (!handled.includes(key) || event.metaKey || event.ctrlKey || event.altKey) return;
    // Stop the shortcut's character from landing in the next step's input.
    event.preventDefault();

    if (key === "c" || key === "1") onPick("cash");
    else if (key === "v" || key === "2") onPick("visa");
    else if (key === "escape" || key === "backspace") onEditAmount();
    else {
      const next = wallet === "cash" ? "visa" : "cash";
      onHighlight(next);
      buttons.current[next]?.focus();
    }
  }

  return (
    <div className="pt-1">
      <Summary type={type} amount={amount} onEditAmount={onEditAmount} />
      <Question en="Cash or Visa?" ar="كاش ولا فيزا؟" />

      <div role="radiogroup" aria-label="Wallet" onKeyDown={handleKeyDown} className="mt-5 grid grid-cols-2 gap-3">
        {WALLET_TYPES.map((option) => {
          const Icon = option === "cash" ? Banknote : CreditCard;
          const selected = option === wallet;
          return (
            <button
              key={option}
              ref={(node) => {
                buttons.current[option] = node;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onPick(option)}
              className={cn(
                "group relative flex flex-col items-start gap-5 rounded-2xl border p-4 text-start outline-none transition active:scale-[0.98]",
                selected
                  ? "border-neutral-900 bg-neutral-50 dark:border-neutral-200 dark:bg-neutral-800/60"
                  : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <Icon className="size-5 text-neutral-500" strokeWidth={1.5} />
                <kbd className="hidden h-5 min-w-5 items-center justify-center rounded border border-neutral-200 px-1 font-mono text-[10px] text-neutral-400 [@media(pointer:fine)]:flex dark:border-neutral-700">
                  {option === "cash" ? "C" : "V"}
                </kbd>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-semibold">{WALLET_LABELS[option].en}</span>
                  <Ar className="text-sm text-neutral-400">{WALLET_LABELS[option].ar}</Ar>
                </div>
                <span className="mt-0.5 block text-xs text-neutral-500 tabular-nums">
                  {formatMoney(balances[option])}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DescriptionStep({
  type,
  amount,
  wallet,
  description,
  suggestions,
  budgets,
  budgetId,
  onBudgetChange,
  autoFocus,
  onEditAmount,
  onDescriptionChange,
  onBack,
  onSubmit,
}: {
  type: TransactionType;
  amount: number;
  wallet: WalletType;
  description: string;
  suggestions: string[];
  budgets: Budget[];
  budgetId: string | null;
  onBudgetChange: (id: string | null) => void;
  autoFocus: boolean;
  onEditAmount: () => void;
  onDescriptionChange: (value: string) => void;
  onBack: () => void;
  onSubmit: (text?: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const question = QUESTIONS[type];

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pt-1">
      <Summary type={type} amount={amount} wallet={wallet} onEditAmount={onEditAmount} />
      <Question en={question.en} ar={question.ar} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="relative mt-5"
      >
        <input
          ref={inputRef}
          dir="auto"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" || (event.key === "Backspace" && description === "")) {
              event.preventDefault();
              onBack();
            } else if (event.key === "Tab" && !event.shiftKey && description && suggestions[0]) {
              event.preventDefault();
              onDescriptionChange(suggestions[0]);
            }
          }}
          maxLength={120}
          enterKeyHint="done"
          autoComplete="off"
          aria-label={question.en}
          placeholder={PLACEHOLDERS[type]}
          className="h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 pe-[5.5rem] ps-4 text-base outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-800/50 dark:placeholder:text-neutral-500 dark:focus:border-neutral-600 dark:focus:bg-neutral-900"
        />
        <button
          type="submit"
          onMouseDown={(event) => event.preventDefault()}
          className="absolute end-1.5 top-1.5 flex h-9 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white transition hover:bg-neutral-800 active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Save
          <CornerDownLeft className="size-3.5 opacity-60" strokeWidth={1.75} />
        </button>
      </form>

      {budgets.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-neutral-500">
            Budget <span aria-hidden className="text-neutral-300 dark:text-neutral-600">·</span>{" "}
            <Ar className="text-neutral-400">من أنهي بند؟</Ar>
          </p>
          <div
            role="radiogroup"
            aria-label="Budget"
            className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {budgets.map((budget) => {
              const selected = budget.id === budgetId;
              return (
                <button
                  key={budget.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onBudgetChange(selected ? null : budget.id)}
                  className={cn(
                    "h-8 shrink-0 rounded-full border px-3 text-[13px] transition active:scale-[0.97]",
                    selected
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-700",
                  )}
                >
                  <bdi>{budget.name}</bdi>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div
          className="-mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Suggestions"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSubmit(suggestion)}
              className="h-8 shrink-0 rounded-full border border-neutral-200 px-3 text-[13px] text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 active:scale-[0.97] dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <bdi>{suggestion}</bdi>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
