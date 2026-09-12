import type { RiskLevel } from "@/lib/types"
import { cn } from "@/lib/utils"

const RISK_CLASS: Record<RiskLevel, string> = {
  red: "border-destructive/40 text-destructive-foreground",
  amber: "border-warning/40 text-warning-foreground",
  green: "border-success/40 text-success-foreground",
  unknown: "border-border text-muted-foreground",
}

export function RiskPill({ risk, className }: { risk: RiskLevel; className?: string }) {
  return (
    <span
      data-risk={risk}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs lowercase",
        RISK_CLASS[risk],
        className,
      )}
    >
      {risk}
    </span>
  )
}

/**
 * Shown wherever fixture data is on screen. Deliberately loud: the point is
 * that nobody records a demo with fake numbers by accident.
 */
export function FixturePill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-2.5 py-0.5 font-mono text-xs text-warning-foreground",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-warning" />
      fixture data
    </span>
  )
}

export function StatusBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  )
}
