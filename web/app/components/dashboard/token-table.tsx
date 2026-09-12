"use client"

import { ArrowDown, ArrowUp } from "lucide-react"

import { RiskPill } from "@/components/dashboard/pills"
import { useTooltip } from "@/components/dashboard/use-tooltip"
import { RATIO_CAP, deriveRisk } from "@/lib/api"
import { compactUsd, percent, priceUsd, ratio as fmtRatio } from "@/lib/format"
import type { RiskLevel, TokenScore } from "@/lib/types"
import { cn } from "@/lib/utils"

export type SortKey =
  | "symbol"
  | "price"
  | "sellable"
  | "safeCap"
  | "exposure"
  | "ratio"
  | "dumpCost"
  | "pumpCost"
  | "risk"
export type SortDir = "asc" | "desc"

const RISK_ORDER: Record<RiskLevel, number> = { red: 3, amber: 2, green: 1, unknown: 0 }

const TIP_SELLABLE = "usd you could sell on uniswap v3 before price moves 10%"
const TIP_SAFE_CAP = "30% of sellable depth. the most a market should be willing to lend against this token."
const TIP_RATIO = "lent against it ÷ safe cap. above 1 means more is lent than the safe cap allows."
const TIP_DUMP =
  "usd of the token that must be sold to push its price down by the deposit-weighted liquidation threshold gap (the morpho pattern)"
const TIP_PUMP = "usd of quote tokens needed to double the price (the moonwell pattern)"
const TIP_TRUNCATED = "tick walk hit the page cap; remainder extrapolated"

const COLUMNS: { key: SortKey; label: string; tip?: string; numeric: boolean }[] = [
  { key: "symbol", label: "token", numeric: false },
  { key: "price", label: "price", numeric: true },
  { key: "sellable", label: "sellable (10% move)", tip: TIP_SELLABLE, numeric: true },
  { key: "safeCap", label: "safe cap (30%)", tip: TIP_SAFE_CAP, numeric: true },
  { key: "exposure", label: "lent against it", numeric: true },
  { key: "ratio", label: "ratio", tip: TIP_RATIO, numeric: true },
  { key: "dumpCost", label: "dump cost", tip: TIP_DUMP, numeric: true },
  { key: "pumpCost", label: "pump cost (2×)", tip: TIP_PUMP, numeric: true },
  { key: "risk", label: "risk", numeric: false },
]

function valueFor(token: TokenScore, key: SortKey): number | string | null {
  switch (key) {
    case "symbol":
      return token.symbol
    case "price":
      return token.priceUsd
    case "sellable":
      return token.sellableDepthUsd
    case "safeCap":
      return token.safeCapUsd
    case "exposure":
      return token.exposureUsd
    case "ratio":
      return token.exposureRatio
    case "dumpCost":
      return token.liquidationAttackCostUsd
    case "pumpCost":
      return token.pumpCostUsd
    case "risk":
      return RISK_ORDER[deriveRisk(token)]
  }
}

/** Missing values always sink, whichever way the column is sorted. */
function compare(a: TokenScore, b: TokenScore, key: SortKey, dir: SortDir): number {
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

export function sortTokens(tokens: TokenScore[], key: SortKey, dir: SortDir) {
  // no_venue tokens are not "safe", they are unmeasured, so they never enter
  // the ranking. They sit below a divider instead.
  const ranked = tokens.filter((token) => token.depthStatus !== "no_venue")
  const unknown = tokens.filter((token) => token.depthStatus === "no_venue")
  return {
    ranked: [...ranked].sort((a, b) => compare(a, b, key, dir)),
    unknown: [...unknown].sort((a, b) => compare(a, b, "exposure", "desc")),
  }
}

function Row({
  token,
  onSelect,
  big,
  tip,
}: {
  token: TokenScore
  onSelect: (token: TokenScore) => void
  big: boolean
  tip: (text: string) => Record<string, unknown>
}) {
  const risk = deriveRisk(token)
  const capped = token.exposureRatio !== null && token.exposureRatio >= RATIO_CAP
  return (
    <tr
      data-risk={risk}
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
        <div className="flex items-center gap-2">
          <span className="font-medium tracking-tight">{token.symbol}</span>
          {token.error ? (
            <span
              {...tip(`last refresh failed for this token: ${token.error}`)}
              className="cursor-help rounded-full border border-warning/40 px-1.5 font-mono text-[10px] text-warning-foreground"
            >
              stale
            </span>
          ) : null}
        </div>
        <div className="truncate font-mono text-xs text-muted-foreground">{token.protocols.join(", ") || "—"}</div>
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{priceUsd(token.priceUsd)}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">
        {token.truncated && token.sellableDepthUsd !== null ? (
          <span {...tip(TIP_TRUNCATED)} className="cursor-help underline decoration-dotted underline-offset-4">
            ~{compactUsd(token.sellableDepthUsd)}
          </span>
        ) : (
          compactUsd(token.sellableDepthUsd)
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{compactUsd(token.safeCapUsd)}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{compactUsd(token.exposureUsd)}</td>
      <td
        className={cn(
          "px-4 py-3 text-right font-mono tabular-nums",
          token.exposureRatio !== null && token.exposureRatio > 1 && "text-destructive-foreground",
        )}
      >
        {capped ? (
          <span {...tip(`ratio is capped at ${RATIO_CAP} by the engine`)} className="cursor-help">
            ≥{RATIO_CAP}
          </span>
        ) : (
          fmtRatio(token.exposureRatio)
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">
        {token.liquidationAttackCostUsd !== null ? (
          <span
            {...tip(`${TIP_DUMP}. for ${token.symbol} that gap is ${percent(token.requiredDrop)}.`)}
            className="cursor-help underline decoration-dotted underline-offset-4"
          >
            {compactUsd(token.liquidationAttackCostUsd)}
          </span>
        ) : (
          compactUsd(null)
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{compactUsd(token.pumpCostUsd)}</td>
      <td className="px-4 py-3">
        <RiskPill risk={risk} />
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
  tokens: TokenScore[]
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  onSelect: (token: TokenScore) => void
  big?: boolean
}) {
  const { triggerProps, tooltip } = useTooltip()
  const { ranked, unknown } = sortTokens(tokens, sortKey, sortDir)

  return (
    <>
      <div className="overflow-x-auto border-x border-t border-border">
        <table className="w-full min-w-[1040px] border-collapse text-left">
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
              <Row key={token.tokenAddress} token={token} onSelect={onSelect} big={big} tip={triggerProps} />
            ))}
            {unknown.length > 0 ? (
              <tr className="border-b border-border bg-muted/40">
                <td colSpan={COLUMNS.length} className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  no uniswap venue found, depth unknown
                </td>
              </tr>
            ) : null}
            {unknown.map((token) => (
              <Row key={token.tokenAddress} token={token} onSelect={onSelect} big={big} tip={triggerProps} />
            ))}
          </tbody>
        </table>
      </div>
      {tooltip}
    </>
  )
}
