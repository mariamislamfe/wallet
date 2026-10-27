import { round2 } from "@/lib/finance";
import type { TransactionType } from "@/types/finance";

// Parses card-alert SMS (Arabic or English) into a transaction. Bank wording
// varies, so this keys off a few signals rather than one exact template:
// the first EGP amount that isn't a balance/limit, a direction keyword, and
// the merchant after "at" / "لدى".

export type ParsedSms =
  | { ok: true; type: TransactionType; amount: number; merchant: string | null }
  | { ok: false; reason: string };

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

// A number not glued to letters, card masks ("XXXX1234") or other digits, and
// not the day/hour of a date or time that follows ("27/10", "10:15").
const NUMBER = String.raw`(?<![\w*.,/])(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d/:])`;
const LATIN_CURRENCY = String.raw`\b(?:EGP|L\.?E)\b\.?`;
const ARABIC_CURRENCY = String.raw`(?:جنيه(?:ا|اً)?|جم|ج\.\s?م\.?)`;
const GAP = String.raw`\s*`;
// English alerts write "EGP 250", Arabic ones "250 جنيه"; the reverse forms are a fallback.
const AMOUNT_TIERS = [
  [new RegExp(LATIN_CURRENCY + GAP + NUMBER, "gi"), new RegExp(NUMBER + GAP + ARABIC_CURRENCY, "g")],
  [new RegExp(NUMBER + GAP + LATIN_CURRENCY, "gi"), new RegExp(ARABIC_CURRENCY + GAP + NUMBER, "g")],
];
const FOREIGN = /\b(?:USD|EUR|GBP|SAR|AED|KWD|QAR|TRY)\b|دولار|يورو|ريال|درهم/i;

// An amount with one of these words just before it is a balance or limit, not the transaction.
const BALANCE_CONTEXT = /available|avail|\bavl\b|balance|\bbal\b|limit|الرصيد|رصيد|المتاح|متاح|الحد/i;
const BALANCE_LOOKBACK = 28;

const SKIP: [RegExp, string][] = [
  [/\b(?:otp|one[\s-]?time|verification|passcode|password)\b|كلمة\s?(?:السر|المرور)|رمز|كود|لا\s+تشارك/i, "one-time password"],
  [/\b(?:declined|rejected|unsuccessful|failed|insufficient)\b|مرفوض|رفض|لم\s+تتم|غير\s+كاف/i, "declined"],
  [/\b(?:atm|withdraw(?:al|n)?|cash\s+advance)\b|سحب/i, "cash withdrawal"],
];

const TRANSFER = /\b(?:transfer(?:red)?|instapay|ipn)\b|تحويل|انستاباي|إنستاباي/i;

// Incoming is checked first, so "transfer received" / "تحويل وارد" stay income.
const INCOME = /\b(?:credited|deposit(?:ed)?|received|refund(?:ed)?|reversal|reversed|added\s+to|transfer(?:red)?\s+from)\b|إيداع|ايداع|استرداد|مرتجع|إضافة|اضافة|وارد|إستلام|استلام|استقبال/i;
const EXPENSE = /\b(?:charged|purchase[ds]?|debited|used|paid|payment|spent|transaction|transfer(?:red)?|sent|instapay|ipn)\b|خصم|شراء|مشتريات|سداد|دفع|عملية|حركة|تحويل|حولت|إرسال|ارسال|انستاباي|إنستاباي/i;

// `\b` only understands ASCII, so Arabic words are delimited by whitespace instead.
const MERCHANT = [
  /\bat\s+(.+?)(?=\s+on\s+\d|\s+(?:dated|date|available|avl|bal)\b|\s*[.,;]\s|\s*[.,;]?$)/i,
  /(?:^|\s)(?:لدى|لدي|عند|لصالح)\s+(.+?)(?=\s+(?:في|بتاريخ|يوم|بتوقيت|الرصيد|المتاح|رصيد)(?:\s|$)|\s*[.،,;]\s|\s*[.،,;]?$)/,
];

function normalise(text: string): string {
  return text
    .replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) & 0xf))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function findAmount(text: string): number | null {
  for (const tier of AMOUNT_TIERS) {
    const hits: { index: number; value: number }[] = [];
    for (const pattern of tier) {
      for (const match of text.matchAll(pattern)) {
        const before = text.slice(Math.max(0, match.index - BALANCE_LOOKBACK), match.index);
        if (BALANCE_CONTEXT.test(before)) continue;
        const value = Number(match[1]!.replace(/,/g, ""));
        if (Number.isFinite(value) && value > 0) hits.push({ index: match.index, value });
      }
    }
    if (hits.length > 0) return round2(hits.sort((a, b) => a.index - b.index)[0]!.value);
  }
  return null;
}

function findMerchant(text: string): string | null {
  for (const pattern of MERCHANT) {
    const name = pattern.exec(text)?.[1]?.trim();
    if (name && name.length >= 2 && !/^\d/.test(name)) return name.slice(0, 60);
  }
  return null;
}

export function parseBankSms(raw: string): ParsedSms {
  const text = normalise(raw);
  if (!text) return { ok: false, reason: "empty message" };

  for (const [pattern, reason] of SKIP) {
    if (pattern.test(text)) return { ok: false, reason };
  }

  const amount = findAmount(text);
  if (amount === null) {
    return { ok: false, reason: FOREIGN.test(text) ? "foreign currency" : "no EGP amount found" };
  }

  const type: TransactionType | null = INCOME.test(text) ? "income" : EXPENSE.test(text) ? "expense" : null;
  if (!type) return { ok: false, reason: "not a card transaction" };

  const merchant = findMerchant(text) ?? (TRANSFER.test(text) ? "InstaPay transfer" : null);
  return { ok: true, type, amount, merchant };
}
