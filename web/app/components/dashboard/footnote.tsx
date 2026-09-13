"use client"

import { prettySource } from "@/lib/format"
import { useMeta } from "@/lib/use-meta"

export function Footnote() {
  const { meta } = useMeta()

  return (
    <div id="how-this-works" className="scroll-mt-20 border-x border-t border-border px-4 py-4">
      {meta ? (
        <p className="font-mono text-xs text-muted-foreground">
          sources: {meta.subgraphs.map((s) => prettySource(s.name)).join(" · ")}
        </p>
      ) : null}
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        depth is uniswap v3 only. tokens whose liquidity lives on curve, balancer, pendle or other venues show as
        unknown, not shallow. exposure is the sum of deposits × max ltv per market, an upper bound. safe cap is 30% of
        sellable depth, and ratio is exposure ÷ safe cap, so 1.0 means a market has lent exactly the safe cap.
      </p>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        risk is derived in this page, not by the api: no uniswap venue → unknown, ratio above 1 → red, above 0.5 →
        amber, otherwise green. numbers are from the block shown in the header and refresh on a schedule. mainnet only.
        not audited.
      </p>
    </div>
  )
}
