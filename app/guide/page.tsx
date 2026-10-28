import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Braces,
  GitBranch,
  Globe,
  KeyRound,
  MessageSquareText,
  WalletMinimal,
  type LucideIcon,
} from "lucide-react";

import { CopyField } from "@/components/copy-field";

export const metadata: Metadata = {
  title: "Bank SMS setup · Wallet",
  description: "Connect bank SMS to Wallet with an iPhone Shortcut, step by step.",
};

// Arabic page, but not lang="ar" on the wrapper: the global `:lang(ar)` size bump would compound.
// English UI names (what the iPhone shows) sit in LTR chips.

/** An exact label from the iPhone UI, kept LTR inside Arabic text. */
function Ui({ children }: { children: React.ReactNode }) {
  return (
    <bdi
      dir="ltr"
      className="mx-0.5 inline-block rounded-md bg-neutral-100 px-1.5 py-px font-sans text-[0.85em] font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
    >
      {children}
    </bdi>
  );
}

/** A path through the UI: Shortcuts → Automation → +. Rendered LTR, as on the phone. */
function Path({ steps }: { steps: string[] }) {
  return (
    <span dir="ltr" className="inline-flex flex-wrap items-center gap-1 align-middle">
      {steps.map((step, i) => (
        <span key={step} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-neutral-400">→</span>}
          <Ui>{step}</Ui>
        </span>
      ))}
    </span>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative ps-12">
      <span className="absolute start-0 top-0 flex size-8 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">
        {n}
      </span>
      <h2 className="pt-1 text-[17px] font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">{children}</div>
    </li>
  );
}

type Row = { label: string; value: React.ReactNode };

/** Looks like an action block in the Shortcuts editor. */
function Action({ icon: Icon, color, name, rows }: { icon: LucideIcon; color: string; name: string; rows: Row[] }) {
  return (
    <div dir="ltr" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white text-start dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2.5 border-b border-neutral-100 px-3.5 py-2.5 dark:border-neutral-800">
        <span className={`flex size-7 items-center justify-center rounded-lg text-white ${color}`}>
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <span className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">{name}</span>
      </div>
      <dl className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 px-3.5 py-2.5 text-[14px]">
            <dt className="shrink-0 text-neutral-500">{row.label}</dt>
            <dd className="min-w-0 text-end font-medium break-words text-neutral-900 dark:text-neutral-100">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A Shortcuts variable token (the blue pills). */
function Variable({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-md bg-sky-100 px-1.5 py-px text-[13px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
      {children}
    </span>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[14px] leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      {children}
    </p>
  );
}

const PROBLEMS: { error: string; fix: React.ReactNode }[] = [
  {
    error: "Wrong token (no Authorization header)",
    fix: (
      <>
        الهيدر اتعمل في سطرين. لازم سطر واحد بس: الـ Key هو <Ui>Authorization</Ui> والـ Value هو <Ui>Bearer</Ui> ومسافة
        وبعدها التوكن.
      </>
    ),
  },
  {
    error: "Wrong token (got … characters …)",
    fix: <>التوكن اتنسخ ناقص، أو اتعمل توكن أجدد منه. اعمل توكن جديد من التطبيق وحطه مكان القديم.</>,
  },
  {
    error: "Skipped: …",
    fix: <>الرسالة دي مش عملية دفع أو تحويل (كود OTP، عملية مرفوضة، سحب من ATM). ده طبيعي ومش هتتسجل.</>,
  },
  {
    error: "مفيش أي إشعار خالص",
    fix: (
      <>
        اتأكد إن الـ Automation على <Ui>Run Immediately</Ui>، وإن الكلمة اللي في <Ui>Message Contains</Ui> موجودة فعلاً
        في رسالة البنك.
      </>
    ),
  },
];

export default async function GuidePage() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const endpoint = `${proto}://${host}/api/sms`;

  return (
    <main dir="rtl" className="mx-auto w-full max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-20 sm:pt-14">
      <Link
        href="/"
        dir="ltr"
        className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
          <WalletMinimal className="size-3.5" strokeWidth={1.75} />
        </span>
        Wallet
      </Link>

      <header className="mt-10">
        <p dir="ltr" className="text-end text-[13px] font-medium text-neutral-500">
          Bank SMS · iPhone Shortcut
        </p>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold">ربط رسايل البنك بالمحفظة</h1>
        <p className="mt-3 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
          كل ما تدفع بالفيزا أو تحوّل InstaPay البنك بيبعت رسالة. الـ Shortcut ده بيبعتها للتطبيق، فالعملية تتسجل
          لوحدها ويجيلك إشعار فيه اللي فاضل معاك. محتاج iPhone وتطبيق Shortcuts اللي موجود عليه أصلاً، والإعداد بياخد
          حوالي ٥ دقايق.
        </p>

        <div dir="ltr" className="mt-6 flex items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white p-3 text-[12px] font-medium text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          {[
            { icon: MessageSquareText, label: "Bank SMS" },
            { icon: Globe, label: "Shortcut" },
            { icon: WalletMinimal, label: "Wallet" },
            { icon: Bell, label: "Notification" },
          ].map(({ icon: Icon, label }, i) => (
            <span key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-neutral-300 dark:text-neutral-600">→</span>}
              <span className="flex flex-col items-center gap-1">
                <Icon className="size-4" strokeWidth={1.75} />
                {label}
              </span>
            </span>
          ))}
        </div>
      </header>

      <ol className="mt-10 space-y-10">
        <Step n={1} title="اعمل توكن من التطبيق">
          <p>
            افتح المحفظة، ودوس على الدايرة اللي فيها أول حرف من إيميلك فوق على اليمين، واختار{" "}
            <Path steps={["Bank SMS", "Set up · make a token"]} /> من اللي هيفتح
          </p>
          <p>
            هيظهرلك التوكن والرابط. انسخ التوكن وحطه في Notes مؤقتاً، لأنه بيظهر مرة واحدة بس. ولو ضاع اعمل واحد جديد عادي.
          </p>
          <CopyField label="URL" value={endpoint} />
        </Step>

        <Step n={2} title="اعمل Automation للرسايل">
          <p>
            في تطبيق Shortcuts: <Path steps={["Automation", "+", "Message"]} />
          </p>
          <Action
            icon={MessageSquareText}
            color="bg-emerald-500"
            name="When I get a message"
            rows={[
              { label: "Message Contains", value: "19888" },
              { label: "Sender", value: <span className="text-neutral-400">Any</span> },
              { label: "Run", value: "Run Immediately" },
            ]}
          />
          <p>
            <Ui>19888</Ui> هو رقم خدمة عملاء بنك مصر، وموجود في كل رسالة عملية. لو بنك تاني، اختار كلمة أو رقم بييجي في كل
            رسايل العمليات بتاعته.
          </p>
          <p>
            لازم تختار <Ui>Run Immediately</Ui> مش <Ui>Run After Confirmation</Ui> عشان يشتغل لوحده من غير ما يسألك.
            بعدها دوس <Path steps={["Next", "New Blank Automation"]} /> وكمّل الخطوة الجاية
          </p>
        </Step>

        <Step n={3} title="ابعت الرسالة للتطبيق">
          <p>
            دوس <Ui>Add Action</Ui> وابحث عن <Ui>Get Contents of URL</Ui>. حط الرابط، وبعدين دوس <Ui>Show More</Ui> وظبط
            الباقي كده:
          </p>
          <Action
            icon={Globe}
            color="bg-sky-500"
            name="Get Contents of URL"
            rows={[
              { label: "URL", value: <span className="font-mono text-[12px]">…/api/sms</span> },
              { label: "Method", value: "POST" },
              { label: "Header · Key", value: "Authorization" },
              { label: "Header · Value", value: <span className="font-mono text-[12px]">Bearer &lt;token&gt;</span> },
              { label: "Request Body", value: "JSON" },
              { label: "Field · Key", value: "text" },
              {
                label: "Field · Value",
                value: (
                  <>
                    <Variable>Shortcut Input</Variable> → <Variable>Content</Variable>
                  </>
                ),
              },
            ]}
          />
          <Tip>
            <b className="font-semibold">الهيدر سطر واحد بس:</b> دوس <Ui>Add new header</Ui> مرة واحدة. في خانة Key اكتب{" "}
            <Ui>Authorization</Ui>، وفي خانة Value اكتب <Ui>Bearer</Ui> وبعدها مسافة وبعدها الصق التوكن.
          </Tip>
          <Tip>
            <b className="font-semibold">لو مش لاقي Shortcut Input:</b> في الـ JSON دوس <Ui>Add new field</Ui> واختار{" "}
            <Ui>Text</Ui>، واكتب في الـ Key <Ui>text</Ui>. بعدين دوس على خانة الـ Value واختار <Ui>Select Variable</Ui> ثم{" "}
            <Variable>Shortcut Input</Variable>. بعد كده دوس على المتغير نفسه واختار <Ui>Content</Ui> من القايمة
          </Tip>
        </Step>

        <Step n={4} title="خد نص الإشعار من الرد">
          <p>
            ضيف أكشن <Ui>Get Dictionary Value</Ui> وظبطه كده:
          </p>
          <Action
            icon={Braces}
            color="bg-orange-500"
            name="Get Dictionary Value"
            rows={[
              { label: "Get", value: "Value" },
              { label: "for", value: "notify" },
              { label: "in", value: <Variable>Contents of URL</Variable> },
            ]}
          />
        </Step>

        <Step n={5} title="اعرض الإشعار">
          <p>
            ضيف أكشن <Ui>If</Ui> عشان لو الرد فيه إشعار يظهر، ولو فيه مشكلة تظهر رسالة الخطأ وتعرف تصلّحها.
          </p>
          <Action
            icon={GitBranch}
            color="bg-neutral-500"
            name="If"
            rows={[
              { label: "If", value: <Variable>Dictionary Value</Variable> },
              { label: "Condition", value: "has any value" },
            ]}
          />
          <Action
            icon={Bell}
            color="bg-rose-500"
            name="Show Notification (inside If)"
            rows={[{ label: "Text", value: <Variable>Dictionary Value</Variable> }]}
          />
          <Action
            icon={Bell}
            color="bg-rose-500"
            name="Show Notification (inside Otherwise)"
            rows={[{ label: "Text", value: <Variable>Contents of URL</Variable> }]}
          />
          <Tip>
            لو الـ If اختار <Ui>File Size</Ui> لوحده، دوس عليه وغيّر النوع لـ <Ui>Text</Ui>، وبعدين اختار{" "}
            <Ui>has any value</Ui> من القايمة
          </Tip>
        </Step>

        <Step n={6} title="جرّب">
          <p>
            اعمل عملية صغيرة، زي تحويل InstaPay بجنيه. أول ما رسالة البنك توصل، العملية هتظهر في المحفظة وعليها علامة{" "}
            <Ui>SMS</Ui>، وهيجيلك إشعار شكله كده:
          </p>
          <div dir="ltr" className="rounded-2xl border border-neutral-200 bg-white/80 p-3.5 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
            <div className="flex items-center gap-2 text-[12px] text-neutral-500">
              <span className="flex size-5 items-center justify-center rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                <WalletMinimal className="size-3" />
              </span>
              SHORTCUTS <span className="ms-auto">now</span>
            </div>
            <p className="mt-1.5 text-[14px] font-semibold">−EGP 44.00 · Top Up ETI</p>
            <p dir="rtl" className="text-start text-[14px] text-neutral-600 dark:text-neutral-400">
              تقدري تصرفي: EGP 526.00
            </p>
          </div>
        </Step>
      </ol>

      <section className="mt-14">
        <h2 className="text-[17px] font-semibold">لو حاجة مش شغالة</h2>
        <p className="mt-1 text-[14px] text-neutral-500">
          الإشعار بيقولك المشكلة. دوّر على الرسالة اللي ظهرتلك هنا:
        </p>
        <ul className="mt-4 space-y-3">
          {PROBLEMS.map((problem) => (
            <li key={problem.error} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <p dir="auto" className="font-mono text-[13px] font-medium text-red-600 dark:text-red-400">
                {problem.error}
              </p>
              <p className="mt-1.5 text-[14px] leading-6 text-neutral-600 dark:text-neutral-400">{problem.fix}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 flex items-start gap-2 text-[13px] leading-6 text-neutral-500">
          <KeyRound className="mt-1 size-3.5 shrink-0" strokeWidth={1.75} />
          التوكن ده زي الباسورد، أي حد معاه يقدر يسجّل عمليات في محفظتك. متبعتهوش لحد، ولو اتسرّب اعمل توكن جديد والقديم هيبطل
          على طول.
        </p>
      </section>

      <Link
        href="/"
        className="mt-12 flex h-12 items-center justify-center gap-2 rounded-xl bg-neutral-900 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        <ArrowLeft className="size-4 rotate-180" strokeWidth={1.75} />
        ارجع للمحفظة
      </Link>
    </main>
  );
}
