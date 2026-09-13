import { env, type Env } from "../config"
import { log, errorMessage } from "../log"
import { fetchSubgraphMeta } from "./graph"
import { fetchMessariMarkets } from "./lending.messari"
import { fetchAaveMarkets } from "./lending.aave"
import type { Market, Protocol } from "../engine/types"

export type LendingSource = {
  name: string
  id: string
  protocol: Protocol
  schema: "messari" | "aave"
}

export type LendingSnapshot = {
  markets: Market[]
  /** markets per protocol label, e.g. { "aave-v3": 31, "compound-v3": 12 } */
  counts: Record<string, number>
  /** lowest indexed block across the lending subgraphs that answered */
  block: number
  /** sources that failed this round (logged, not fatal unless all fail) */
  failed: string[]
}

export function lendingSources(e: Env = env): LendingSource[] {
  if (e.LENDING_SOURCE === "aave") {
    return e.AAVE_V3_OFFICIAL_SUBGRAPH_ID
      ? [{ name: "aave-v3-ethereum", id: e.AAVE_V3_OFFICIAL_SUBGRAPH_ID, protocol: "aave-v3", schema: "aave" }]
      : []
  }
  const sources: LendingSource[] = []
  if (e.MESSARI_AAVE_V3_SUBGRAPH_ID)
    sources.push({ name: "messari-aave-v3-ethereum", id: e.MESSARI_AAVE_V3_SUBGRAPH_ID, protocol: "aave-v3", schema: "messari" })
  if (e.MESSARI_COMPOUND_V3_SUBGRAPH_ID)
    sources.push({ name: "messari-compound-v3-ethereum", id: e.MESSARI_COMPOUND_V3_SUBGRAPH_ID, protocol: "compound-v3", schema: "messari" })
  if (e.MORPHO_BLUE_SUBGRAPH_ID)
    sources.push({ name: "morpho-blue-ethereum", id: e.MORPHO_BLUE_SUBGRAPH_ID, protocol: "morpho-blue", schema: "messari" })
  return sources
}

/**
 * Fetch every collateral market from all configured lending subgraphs.
 * Markets are not deduplicated: one token legitimately appears once per market.
 */
export async function fetchAllMarkets(e: Env = env): Promise<LendingSnapshot> {
  const sources = lendingSources(e)
  if (sources.length === 0) throw new Error("no lending subgraphs configured")

  const results = await Promise.allSettled(
    sources.map(async (s) => {
      const [meta, markets] = await Promise.all([
        fetchSubgraphMeta(s.id),
        s.schema === "messari"
          ? fetchMessariMarkets(s.id, s.protocol, e.MIN_MARKET_DEPOSIT_USD)
          : fetchAaveMarkets(s.id, e.MIN_MARKET_DEPOSIT_USD),
      ])
      if (meta.hasIndexingErrors) {
        log.warn(`lending source ${s.name} (${s.id}) has indexing errors — its data may be stale or empty`)
      }
      if (markets.length === 0) {
        log.warn(
          `lending source ${s.name} (${s.id}) returned 0 markets at block ${meta.block} (hasIndexingErrors=${meta.hasIndexingErrors}); check the subgraph id and MIN_MARKET_DEPOSIT_USD=${e.MIN_MARKET_DEPOSIT_USD}`
        )
      }
      return { source: s, block: meta.block, markets }
    })
  )

  const markets: Market[] = []
  const counts: Record<string, number> = {}
  const failed: string[] = []
  let block = Number.POSITIVE_INFINITY

  results.forEach((r, i) => {
    const s = sources[i]!
    if (r.status === "fulfilled") {
      markets.push(...r.value.markets)
      counts[s.protocol] = (counts[s.protocol] ?? 0) + r.value.markets.length
      block = Math.min(block, r.value.block)
    } else {
      failed.push(s.name)
      log.error(`lending source ${s.name} failed: ${errorMessage(r.reason)}`)
    }
  })

  if (failed.length === sources.length) {
    throw new Error(`all lending sources failed: ${failed.join(", ")}`)
  }
  return { markets, counts, block: Number.isFinite(block) ? block : 0, failed }
}

/** Group markets by lowercase token address. */
export function marketsByToken(markets: Market[]): Map<string, Market[]> {
  const byToken = new Map<string, Market[]>()
  for (const m of markets) {
    const list = byToken.get(m.token.address)
    if (list) list.push(m)
    else byToken.set(m.token.address, [m])
  }
  return byToken
}
