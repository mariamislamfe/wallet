import { cn } from "@/lib/client";

/**
 * Inline Arabic text. `dir="rtl"` isolates the run so trailing punctuation
 * (e.g. "؟") lands on the correct side inside LTR layouts.
 */
export function Ar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span lang="ar" dir="rtl" className={cn("inline-block", className)}>
      {children}
    </span>
  );
}
