"use client"

import { ArrowDown, ArrowUp } from "lucide-react"

import { RiskPill } from "@/components/dashboard/pills"
import { useTooltip } from "@/components/dashboard/use-tooltip"
import { useMeta } from "@/lib/use-meta"
import { compactUsd, percent, priceUsd, ratio as fmtRatio } from "@/lib/format"
import type { Token } from "@/lib/types"
import { cn } from "@/lib/utils"

export type SortKey = "symbol" | "price" | "sellable" | "safeCap" | "exposure" | "ratio" | "attackCost" | "risk"
export type SortDir = "asc" | "desc"

const RISK_ORDER: Record<string, number> = { red: 3, amber: 2, green: 1, unknown: 0 }

function columns(safeCapFraction: number | null): { key: SortKey; label: string; tip?: string; numeric: boolean }[] {
  return [
    { key: "symbol", label: "token", numeric: false },
    { key: "price", label: "price", numeric: true },
    {
      key: "sellable",
      label: "sellable (10% move)",
      tip: "usd you could sell on uniswap v3 before price moves 10%",
      numeric: true,
    },
    { key: "safeCap", label: `safe cap (${safeCapFraction === null ? "—" : percent(safeCapFraction)})`, numeric: true },
    { key: "exposure", label: "lent against it", numeric: true },
    {
      key: "ratio",
      label: "ratio",
      tip: "lent against it ÷ sellable. above 1 means more is lent than could be sold.",
      numeric: true,
    },
    { key: "attackCost", label: "attack cost", numeric: true },
    { key: "risk", label: "risk", numeric: false },
  ]
}

function valueFor(token: Token, key: SortKey): number | string | null {
  switch (key) {
    case "symbol":
      return token.symbol
    case "price":
      return token.priceUsd
    case "sellable":
      return token.depth.sellableUsd10pct
    case "safeCap":
      return token.safeCapUsd
    case "exposure":
      return token.exposure.exposureUsd
    case "ratio":
      return token.ratio
    case "attackCost":
      return token.attackCost?.costUsd ?? null
    case "risk":
      return RISK_ORDER[token.risk] ?? 0
  }
}

function compare(a: Token, b: Token, key: SortKey, dir: SortDir): number {
  const av = valueFor(a, key)
  const bv = valueFor(b, key)
  const aMissing = av === null || av === undefined
  const bMissing = bv === null || bv === undefined
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1
  const result = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv)
  return dir === "asc" ? result : -result
}

export function sortTokens(tokens: Token[], key: SortKey, dir: SortDir) {
  const ranked = tokens.filter((token) => token.depth.state !== "unknown")
  const unknown = tokens.filter((token) => token.depth.state === "unknown")
  return {
    ranked: [...ranked].sort((a, b) => compare(a, b, key, dir)),
    unknown: [...unknown].sort((a, b) => compare(a, b, "exposure", "desc")),
  }
}

function attackCostTip(token: Token): string | null {
  if (!token.attackCost) return null
  return `capital needed to move price ${percent(token.attackCost.movePct)} in the ${token.attackCost.direction} direction, computed from pool ticks`
}

function Row({
  token,
  onSelect,
  big,
  tip,
}: {
  token: Token
  onSelect: (token: Token) => void
  big: boolean
  tip: (text: string) => Record<string, unknown>
}) {
  const costTip = attackCostTip(token)
  return (
    <tr
      data-risk={token.risk}
      onClick={() => onSelect(token)}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect(token)
        }
      }}
      className={cn(
        "cursor-pointer border-b border-border transition-colors duration-100 outline-none",
        "hover:bg-accent/70 focus-visible:bg-accent/70 hover:shadow-[inset_3px_0_0_0_var(--foreground)]",
        big ? "text-base" : "text-sm",
      )}
    >
      <td className="px-4 py-3">
        <div className="font-medium tracking-tight">{token.symbol}</div>
        <div className="truncate text-xs text-muted-foreground">{token.name}</div>
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{priceUsd(token.priceUsd)}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{compactUsd(token.depth.sellableUsd10pct)}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{compactUsd(token.safeCapUsd)}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{compactUsd(token.exposure.exposureUsd)}</td>
      <td
        className={cn(
          "px-4 py-3 text-right font-mono tabular-nums",
          token.ratio !== null && token.ratio >= 1 && "text-destructive-foreground",
        )}
      >
        {fmtRatio(token.ratio)}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">
        {costTip ? (
          <span {...tip(costTip)} className="cursor-help underline decoration-dotted underline-offset-4">
            {compactUsd(token.attackCost?.costUsd)}
          </span>
        ) : (
          compactUsd(null)
        )}
      </td>
      <td className="px-4 py-3">
        <RiskPill risk={token.risk} />
      </td>
    </tr>
  )
}

export function TokenTable({
  tokens,
  sortKey,
  sortDir,
  onSort,
  onSelect,
  big = false,
}: {
  tokens: Token[]
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  onSelect: (token: Token) => void
  big?: boolean
}) {
  const { triggerProps, tooltip } = useTooltip()
  const { ranked, unknown } = sortTokens(tokens, sortKey, sortDir)
  const { meta } = useMeta()
  const COLUMNS = columns(meta?.capFraction ?? null)

  return (
    <>
      <div className="overflow-x-auto border-x border-t border-border">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-card">
              {COLUMNS.map((column) => {
                const active = sortKey === column.key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    className={cn(
                      "px-4 py-3 font-mono font-normal tracking-[0.06em] text-muted-foreground uppercase",
                      big ? "text-sm" : "text-xs",
                      column.numeric && "text-right",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      {...(column.tip ? triggerProps(column.tip) : {})}
                      className={cn(
                        "inline-flex items-center gap-1.5 transition-colors duration-100 hover:text-foreground",
                        active && "text-foreground",
                        column.tip && "cursor-help",
                      )}
                    >
                      {column.label}
                      {active ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : null}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ranked.map((token) => (
              <Row key={token.address} token={token} onSelect={onSelect} big={big} tip={triggerProps} />
            ))}
            {unknown.length > 0 ? (
              <tr className="border-b border-border bg-muted/40">
                <td colSpan={COLUMNS.length} className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  no uniswap venue found, depth unknown
                </td>
              </tr>
            ) : null}
            {unknown.map((token) => (
              <Row key={token.address} token={token} onSelect={onSelect} big={big} tip={triggerProps} />
            ))}
          </tbody>
        </table>
      </div>
      {tooltip}
    </>
  )
}
