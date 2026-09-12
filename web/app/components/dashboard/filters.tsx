"use client"

import { Search } from "lucide-react"

import { deriveRisk } from "@/lib/api"
import { prettySource } from "@/lib/format"
import type { RiskLevel, TokenScore } from "@/lib/types"
import { cn } from "@/lib/utils"

export type RiskFilter = RiskLevel | "all"

const RISK_FILTERS: RiskFilter[] = ["all", "red", "amber", "green", "unknown"]

export function protocolsOf(tokens: TokenScore[]): string[] {
  const seen = new Set<string>()
  for (const token of tokens) for (const protocol of token.protocols) seen.add(protocol)
  return [...seen].sort()
}

export function applyFilters(
  tokens: TokenScore[],
  { query, risk, protocol }: { query: string; risk: RiskFilter; protocol: string | null },
): TokenScore[] {
  const needle = query.trim().toLowerCase()
  return tokens.filter((token) => {
    if (needle && !token.symbol.toLowerCase().includes(needle)) return false
    if (risk !== "all" && deriveRisk(token) !== risk) return false
    if (protocol && !token.protocols.includes(protocol as TokenScore["protocols"][number])) return false
    return true
  })
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-xs transition-colors duration-100",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function Filters({
  query,
  onQuery,
  risk,
  onRisk,
  protocol,
  onProtocol,
  protocols,
  count,
}: {
  query: string
  onQuery: (value: string) => void
  risk: RiskFilter
  onRisk: (value: RiskFilter) => void
  protocol: string | null
  onProtocol: (value: string | null) => void
  protocols: string[]
  count: number
}) {
  return (
    <div className="flex flex-col gap-3 border-x border-t border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {RISK_FILTERS.map((value) => (
          <Chip key={value} active={risk === value} onClick={() => onRisk(value)}>
            {value}
          </Chip>
        ))}
        {protocols.length > 0 ? <span aria-hidden className="mx-1 h-4 w-px bg-border" /> : null}
        {protocols.map((value) => (
          <Chip key={value} active={protocol === value} onClick={() => onProtocol(protocol === value ? null : value)}>
            {prettySource(value)}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground">{count} tokens</span>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="filter by symbol"
            aria-label="filter tokens by symbol"
            className="h-8 w-48 border border-input bg-transparent pr-3 pl-8 font-mono text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
        </div>
      </div>
    </div>
  )
}
