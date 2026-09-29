import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { STATUS_LABELS } from "@/lib/format";

type Tone = "neutral" | "good" | "warn" | "critical" | "brand";

const tones: Record<Tone, string> = {
  neutral: "bg-card-2 text-ink-2",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  critical: "bg-critical-soft text-critical",
  brand: "bg-brand-soft text-brand",
};

const icons: Record<Tone, string> = {
  neutral: "○",
  good: "●",
  warn: "▲",
  critical: "■",
  brand: "★",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>
      <span aria-hidden className="text-[0.6rem]">
        {icons[tone]}
      </span>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  trial: "brand",
  active: "good",
  past_due: "warn",
  suspended: "critical",
  cancelled: "neutral",
};

export function SubscriptionBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{STATUS_LABELS[status] ?? status}</Badge>;
}
