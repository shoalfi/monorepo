import type { Metadata } from "next"

import { Header } from "@/components/dashboard/header"

export const metadata: Metadata = {
  title: "aug 2026 incidents · shoalfi",
  description:
    "three lending markets drained in one week of august 2026, reconstructed from public data. none of them were hacks.",
}

interface Source {
  label: string
  href: string | null
}

interface Incident {
  protocol: string
  chain: string
  date: string
  headline: string
  rows: string[]
  sources: Source[]
}

const INCIDENTS: Incident[] = [
  {
    protocol: "moonwell",
    chain: "base",
    date: "aug 27 2026",
    headline: "a $6m token with ~$1.2m of daily volume was allowed to back $11m of loans.",
    rows: [
      "market cap ~$6m",
      "24h volume ~$1.18m",
      "collateral factor 50%",
      "supply cap 20m MAMO",
      "borrow cap 3m MAMO",
      "oracle: spot, no twap",
      "borrowed $11.03m",
      "net loss ~$8.7m",
      "caps set to 1 wei after",
    ],
    sources: [
      {
        label: "the defiant",
        href: "https://thedefiant.io/news/hacks/moonwell-loses-8-7-million-to-mamo-price-manipulation-on-base",
      },
      { label: "cryptoticker", href: "https://cryptoticker.io/en/moonwell-mamo-oracle-exploit-base/" },
      // The protocol's own post-mortem, which is where the $11,028,762 figure comes from.
      { label: "moonwell post-mortem", href: "https://forum.moonwell.fi/t/post-mortem-mamo-market-incident-on-base/2208" },
    ],
  },
  {
    protocol: "morpho / pendle",
    chain: "ethereum",
    date: "aug 25 2026",
    headline: "$320k of trades moved a price 3% and liquidated $36.4m.",
    rows: [
      "11 trades, 04:28–04:37 utc",
      "~$320k SY-reUSD → 9.5m YT-reUSD",
      "pt-reusd −3%",
      "33 liquidations in 14 min",
      "$36.14m debt repaid",
      "$67.5m collateral in the market vs $8.97m pool depth (not directly comparable)",
      "no bad debt",
      "attacker likely netted ~$360k as liquidator",
    ],
    sources: [
      { label: "cryptobriefing", href: "https://cryptobriefing.com/morpho-liquidations-pendle-reusd-cascade/" },
      {
        label: "the crypto times",
        href: "https://www.cryptotimes.io/2026/08/25/morphos-15-minute-twap-oracle-exploited-in-36-4m-liquidation-attack/",
      },
      { label: "crypto daily", href: "https://cryptodaily.co.uk/2026/08/pt-reusd-morpho-liquidations-36m" },
    ],
  },
  {
    protocol: "tectonic",
    chain: "cronos",
    date: "aug 30 2026",
    headline: "TONIC pumped ~100x in 20 minutes. ~$75m borrowed. the chain was halted.",
    rows: ["pre-attack tvl ~$121.7m", "active loans ~$82.7m", "cronos halted and rolled back"],
    sources: [
      {
        label: "coindesk",
        href: "https://www.coindesk.com/tech/2026/08/31/cronos-halts-blockchain-after-usd75-million-lending-exploit-hits-lending-app-tectonic",
      },
      {
        label: "the crypto times",
        href: "https://www.cryptotimes.io/2026/08/31/cronos-halts-entire-blockchain-after-75m-tectonic-exploit-only-6m-escapes/",
      },
      { label: "cryptoticker", href: "https://cryptoticker.io/en/cronos-chain-halt-tectonic-exploit/" },
    ],
  },
]

function Card({ incident }: { incident: Incident }) {
  return (
    <article className="flex flex-col border-b border-border px-4 py-8 md:px-8 lg:border-r lg:border-b-0 lg:last:border-r-0">
      <p className="font-mono text-xs text-muted-foreground">
        {incident.protocol} · {incident.chain} · {incident.date}
      </p>
      <h2 className="mt-3 text-xl leading-snug font-medium tracking-tight text-balance">{incident.headline}</h2>
      <ul className="mt-5 space-y-1.5">
        {incident.rows.map((row) => (
          <li key={row} className="font-mono text-xs leading-relaxed text-muted-foreground">
            {row}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        <p className="font-mono text-xs text-muted-foreground">
          sources:{" "}
          {incident.sources.map((source, index) => (
            <span key={source.label}>
              {index > 0 ? ", " : ""}
              {source.href ? (
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted underline-offset-4 hover:text-foreground"
                >
                  {source.label}
                </a>
              ) : (
                <span title="url pending">{source.label} (url pending)</span>
              )}
            </span>
          ))}
        </p>
      </div>
    </article>
  )
}

export default function Page() {
  return (
    <>
      <Header />
      <main className="min-h-svh">
        <div className="container-x border-x border-border">
          <div className="border-b border-border px-4 py-10 md:px-8">
            <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
              last week of august 2026
            </p>
            <h1 className="mt-3 font-pixel text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.08] tracking-tight">
              three protocols, one week, same attack.
            </h1>
          </div>
          <div className="grid lg:grid-cols-3">
            {INCIDENTS.map((incident) => (
              <Card key={incident.protocol} incident={incident} />
            ))}
          </div>
          <p className="border-t border-border px-4 py-5 text-sm text-muted-foreground md:px-8">
            none of these were hacks. the oracle reported the market price. nobody asked how much could be sold.
          </p>
        </div>
      </main>
    </>
  )
}
