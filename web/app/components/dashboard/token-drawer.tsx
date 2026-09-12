"use client"

import { Check, ChevronDown, Copy, ExternalLink, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { RiskPill } from "@/components/dashboard/pills"
import { ErrorBanner } from "@/components/dashboard/states"
import { deriveRisk, explorerAddressUrl, getToken, marketUrl } from "@/lib/api"
import {
  DASH,
  compactUsd,
  feeTier,
  percent,
  prettySource,
  priceUsd,
  ratio as fmtRatio,
  truncateAddress,
  utcTime,
} from "@/lib/format"
import type { TokenScore } from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label="copy address"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        } catch {
          // Clipboard can be blocked; failing silently beats a toast on camera.
        }
      }}
      className="text-muted-foreground transition-colors duration-100 hover:text-foreground"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border px-5 py-5">
      <h3 className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">{value}</span>
    </div>
  )
}

function TheMath({ token }: { token: TokenScore }) {
  const [open, setOpen] = useState(false)
  const depositTotal = token.markets.reduce((sum, market) => sum + market.depositUsd, 0)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase transition-colors duration-100 hover:text-foreground"
      >
        the math
        <ChevronDown className={`size-3.5 transition-transform duration-100 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="mt-3 space-y-4">
          <div>
            <LedgerRow label="sellable depth (10% move)" value={compactUsd(token.sellableDepthUsd)} />
            <LedgerRow label="× 30% cap fraction" value="" />
            <LedgerRow label="= safe cap" value={compactUsd(token.safeCapUsd)} />
          </div>
          <div>
            <LedgerRow label="Σ deposits across markets" value={compactUsd(depositTotal)} />
            <LedgerRow label="× max ltv (per market)" value="" />
            <LedgerRow label="= lent against it" value={compactUsd(token.exposureUsd)} />
          </div>
          <div>
            <LedgerRow label="lent against it ÷ safe cap" value={fmtRatio(token.exposureRatio)} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function TokenDrawer({ address, onClose }: { address: string; onClose: () => void }) {
  const [token, setToken] = useState<TokenScore | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The parent keys this component by address, so a different token remounts
  // it with fresh state rather than resetting state from inside the effect.
  useEffect(() => {
    const controller = new AbortController()
    getToken(address, controller.signal)
      .then(setToken)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : "unknown error")
      })
    return () => controller.abort()
  }, [address])

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = previous
    }
  }, [handleKey])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={token ? `${token.symbol} details` : "token details"}
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-background"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-5">
          <div className="min-w-0">
            {token ? (
              <>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-medium tracking-tight">{token.symbol}</h2>
                  <RiskPill risk={deriveRisk(token)} />
                </div>
                <div className="mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span>{truncateAddress(token.tokenAddress)}</span>
                  <CopyButton value={token.tokenAddress} />
                  <a
                    href={explorerAddressUrl(token.tokenAddress)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="view on etherscan"
                    className="transition-colors duration-100 hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {token.depthStatus} · computed {utcTime(token.computedAt)}
                </p>
              </>
            ) : (
              <h2 className="font-mono text-sm text-muted-foreground">loading…</h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="text-muted-foreground transition-colors duration-100 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {error ? (
          <div className="px-5 pb-5">
            <ErrorBanner message={error} />
          </div>
        ) : null}

        {!token && !error ? (
          <div className="flex items-center gap-2 px-5 pb-8 font-mono text-xs text-muted-foreground">
            <Spinner className="size-4" /> loading token…
          </div>
        ) : null}

        {token ? (
          <>
            {token.error ? (
              <div className="px-5 pb-4">
                <p className="border border-warning/40 bg-warning/10 px-3 py-2 font-mono text-xs text-warning-foreground">
                  stale: {token.error}
                </p>
              </div>
            ) : null}

            <Section title="headline numbers">
              <div className="grid grid-cols-2 gap-x-6">
                <LedgerRow label="price" value={priceUsd(token.priceUsd)} />
                <LedgerRow label="ratio" value={fmtRatio(token.exposureRatio)} />
                <LedgerRow label="sellable (10% move)" value={compactUsd(token.sellableDepthUsd)} />
                <LedgerRow label="safe cap (30%)" value={compactUsd(token.safeCapUsd)} />
                <LedgerRow label="lent against it" value={compactUsd(token.exposureUsd)} />
                <LedgerRow label={`dump cost (−${percent(token.requiredDrop)})`} value={compactUsd(token.liquidationAttackCostUsd)} />
                <LedgerRow label="pump cost (2×)" value={compactUsd(token.pumpCostUsd)} />
                <LedgerRow label="protocols" value={token.protocols.join(", ") || DASH} />
              </div>
            </Section>

            <Section title="pools">
              {token.pools.length === 0 ? (
                <p className="font-mono text-sm text-muted-foreground">{DASH} no uniswap v3 pools found</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border font-mono text-xs text-muted-foreground">
                      <th className="py-2 font-normal">pair</th>
                      <th className="py-2 text-right font-normal">fee</th>
                      <th className="py-2 text-right font-normal">tvl</th>
                      <th className="py-2 text-right font-normal">depth</th>
                      <th className="py-2 text-right font-normal">dir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {token.pools.map((pool) => (
                      <tr key={`${pool.poolId}-${pool.direction}`} className="border-b border-border last:border-b-0">
                        <td className="py-2">
                          <a
                            href={explorerAddressUrl(pool.poolId)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-dotted underline-offset-4 hover:decoration-solid"
                          >
                            {pool.pair}
                          </a>
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">{feeTier(pool.feeTier)}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{compactUsd(pool.tvlUsd)}</td>
                        <td className="py-2 text-right font-mono tabular-nums">
                          {pool.truncated ? "~" : ""}
                          {compactUsd(pool.depthUsd)}
                        </td>
                        <td className="py-2 text-right font-mono text-xs text-muted-foreground">{pool.direction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title="lending markets">
              {token.markets.length === 0 ? (
                <p className="font-mono text-sm text-muted-foreground">{DASH} no markets returned</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border font-mono text-xs text-muted-foreground">
                      <th className="py-2 font-normal">market</th>
                      <th className="py-2 text-right font-normal">deposits</th>
                      <th className="py-2 text-right font-normal">max ltv</th>
                      <th className="py-2 text-right font-normal">liq. threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {token.markets.map((market) => (
                      <tr key={`${market.protocol}-${market.marketId}`} className="border-b border-border last:border-b-0">
                        <td className="py-2">
                          <a
                            href={marketUrl(market.protocol, market.marketId)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-dotted underline-offset-4 hover:decoration-solid"
                          >
                            {market.marketName ?? prettySource(market.protocol)}
                          </a>
                          <div className="font-mono text-xs text-muted-foreground">
                            {prettySource(market.protocol)}
                          </div>
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">{compactUsd(market.depositUsd)}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{percent(market.maxLtv)}</td>
                        <td className="py-2 text-right font-mono tabular-nums">
                          {percent(market.liquidationThreshold)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <section className="border-t border-b border-border px-5 py-5">
              <TheMath token={token} />
            </section>
          </>
        ) : null}
      </aside>
    </div>
  )
}
