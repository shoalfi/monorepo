"use client"

import { Check, ChevronDown, Copy, ExternalLink, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { RiskPill } from "@/components/dashboard/pills"
import { ErrorBanner } from "@/components/dashboard/states"
import { explorerAddressUrl, getToken, marketUrl } from "@/lib/api"
import { DASH, compactUsd, feeTier, percent, priceUsd, ratio as fmtRatio, prettySource, truncateAddress } from "@/lib/format"
import type { TokenDetail } from "@/lib/types"
import { useMeta } from "@/lib/use-meta"
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
        } catch {}
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

function TheMath({ token, safeCapFraction }: { token: TokenDetail; safeCapFraction: number | null }) {
  const [open, setOpen] = useState(false)
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
            <LedgerRow label="sellable (10% move)" value={compactUsd(token.depth.sellableUsd10pct)} />
            <LedgerRow label={`× ${safeCapFraction === null ? DASH : percent(safeCapFraction)}`} value="safe cap fraction" />
            <LedgerRow label="= safe cap" value={compactUsd(token.safeCapUsd)} />
          </div>
          <div>
            <LedgerRow label="deposits" value={compactUsd(token.exposure.depositsUsd)} />
            <LedgerRow label="× max ltv" value={percent(token.exposure.maxLtv)} />
            <LedgerRow label="= lent against it" value={compactUsd(token.exposure.exposureUsd)} />
          </div>
          <div>
            <LedgerRow label="lent against it ÷ sellable" value={fmtRatio(token.ratio)} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function TokenDrawer({ address, onClose }: { address: string; onClose: () => void }) {
  const [token, setToken] = useState<TokenDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { meta } = useMeta()
  const safeCapFraction = meta?.capFraction ?? null

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
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
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
                  <RiskPill risk={token.risk} />
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{token.name}</p>
                <div className="mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span>{truncateAddress(token.address)}</span>
                  <CopyButton value={token.address} />
                  <a
                    href={explorerAddressUrl(token.address)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="view on etherscan"
                    className="transition-colors duration-100 hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
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
            <div className="px-5 pb-5">
              {token.summary ? (
                <p className="text-lg leading-relaxed text-balance">{token.summary}</p>
              ) : (
                <p className="font-mono text-sm text-muted-foreground">{DASH} no summary returned</p>
              )}
            </div>

            <Section title="headline numbers">
              <div className="grid grid-cols-2 gap-x-6">
                <LedgerRow label="price" value={priceUsd(token.priceUsd)} />
                <LedgerRow label="ratio" value={fmtRatio(token.ratio)} />
                <LedgerRow label="sellable (10% move)" value={compactUsd(token.depth.sellableUsd10pct)} />
                <LedgerRow
                  label={`safe cap (${safeCapFraction === null ? DASH : percent(safeCapFraction)})`}
                  value={compactUsd(token.safeCapUsd)}
                />
                <LedgerRow label="lent against it" value={compactUsd(token.exposure.exposureUsd)} />
                <LedgerRow
                  label={
                    token.attackCost
                      ? `attack cost (${percent(token.attackCost.movePct)} ${token.attackCost.direction})`
                      : "attack cost"
                  }
                  value={compactUsd(token.attackCost?.costUsd)}
                />
              </div>
            </Section>

            <Section title="pools">
              {token.pools.length === 0 ? (
                <p className="font-mono text-sm text-muted-foreground">{DASH} no pools returned</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border font-mono text-xs text-muted-foreground">
                      <th className="py-2 font-normal">pair</th>
                      <th className="py-2 text-right font-normal">fee</th>
                      <th className="py-2 text-right font-normal">tvl</th>
                      <th className="py-2 text-right font-normal">sellable 10%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {token.pools.map((pool) => (
                      <tr key={pool.pool} className="border-b border-border last:border-b-0">
                        <td className="py-2">
                          <a
                            href={explorerAddressUrl(pool.pool)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-dotted underline-offset-4 hover:decoration-solid"
                          >
                            {pool.pair}
                          </a>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {prettySource(pool.venue)}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">{feeTier(pool.feeTier)}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{compactUsd(pool.tvlUsd)}</td>
                        <td className="py-2 text-right font-mono tabular-nums">
                          {compactUsd(pool.sellableUsd10pct)}
                        </td>
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
                      <th className="py-2 font-normal">protocol</th>
                      <th className="py-2 text-right font-normal">ltv</th>
                      <th className="py-2 text-right font-normal">liq. threshold</th>
                      <th className="py-2 text-right font-normal">deposits</th>
                      <th className="py-2 text-right font-normal">borrows</th>
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
                            {prettySource(market.protocol)}
                          </a>
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">{percent(market.ltv)}</td>
                        <td className="py-2 text-right font-mono tabular-nums">
                          {percent(market.liquidationThreshold)}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">{compactUsd(market.depositsUsd)}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{compactUsd(market.borrowsUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <section className="border-t border-b border-border px-5 py-5">
              <TheMath token={token} safeCapFraction={safeCapFraction} />
            </section>
          </>
        ) : null}
      </aside>
    </div>
  )
}
