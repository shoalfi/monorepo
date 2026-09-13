import { env, type Env } from "../config"
import { fetchPoolsForToken, fetchTicks } from "../collector/uniswap"
import {
  pumpCostForToken,
  pumpPlan,
  sellPlan,
  sellableDepthForToken,
  tokenPriceUsd,
} from "./depth"
import type {
  DepthStatus,
  Direction,
  Market,
  Pool,
  Protocol,
  TickPage,
  TokenScore,
} from "./types"

export const RATIO_CAP = 9999

export type TickCache = Map<string, Promise<TickPage>>

export function cachedTicks(
  cache: TickCache,
  pool: Pool,
  direction: Direction,
  boundTick: number
): Promise<TickPage> {
  const key = `${pool.id}|${direction}|${boundTick}`
  let pending = cache.get(key)
  if (!pending) {
    pending = fetchTicks(pool.id, pool.tick, direction, boundTick)
    cache.set(key, pending)
  }
  return pending
}

export type Exposure = {
  exposureUsd: number
  weightedLt: number
  requiredDrop: number
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function exposureFor(markets: Market[]): Exposure {
  let exposureUsd = 0
  let weighted = 0
  let deposits = 0
  for (const m of markets) {
    exposureUsd += m.depositUsd * m.maxLtv
    weighted += m.depositUsd * m.liquidationThreshold
    deposits += m.depositUsd
  }
  const weightedLt = deposits > 0 ? weighted / deposits : 0
  return { exposureUsd, weightedLt, requiredDrop: clamp(1 - weightedLt, 0.01, 0.99) }
}

export function classifyDepth(depthUsd: number | null, shallowUsd: number): DepthStatus {
  if (depthUsd === null) return "no_venue"
  return depthUsd < shallowUsd ? "shallow" : "deep"
}

export function exposureRatio(exposureUsd: number, safeCapUsd: number | null): number | null {
  if (safeCapUsd === null) return null
  if (safeCapUsd > 0) return Math.min(RATIO_CAP, exposureUsd / safeCapUsd)
  return exposureUsd > 0 ? RATIO_CAP : 0
}

export function protocolsOf(markets: Market[]): Protocol[] {
  return [...new Set(markets.map((m) => m.protocol))].sort()
}

export type ScoreInput = {
  address: string
  markets: Market[]
  ethPriceUsd: number
  cache: TickCache
  config?: Env
}

function noVenueScore(input: ScoreInput, exposure: Exposure, priceUsd: number): TokenScore {
  const first = input.markets[0]!
  return {
    tokenAddress: input.address,
    symbol: first.token.symbol,
    decimals: first.token.decimals,
    priceUsd,
    depthStatus: "no_venue",
    sellableDepthUsd: null,
    safeCapUsd: null,
    exposureUsd: exposure.exposureUsd,
    exposureRatio: null,
    liquidationAttackCostUsd: null,
    pumpCostUsd: null,
    requiredDrop: exposure.requiredDrop,
    protocols: protocolsOf(input.markets),
    truncated: false,
    pools: [],
    markets: input.markets,
    error: null,
    computedAt: new Date().toISOString(),
  }
}

export async function scoreToken(input: ScoreInput): Promise<TokenScore> {
  const cfg = input.config ?? env
  const { address, markets, ethPriceUsd, cache } = input
  if (markets.length === 0) throw new Error(`no markets for ${address}`)
  const exposure = exposureFor(markets)

  const pools = await fetchPoolsForToken(address, cfg.MAX_POOLS_PER_TOKEN)
  if (pools.length === 0) return noVenueScore(input, exposure, 0)
  const priceUsd = tokenPriceUsd(address, pools, ethPriceUsd)
  if (!(priceUsd > 0)) return noVenueScore(input, exposure, 0)

  const attackBps = Math.round(exposure.requiredDrop * 10_000)

  const sellPages = new Map<string, TickPage>()
  const pumpPages = new Map<string, TickPage>()
  await Promise.all(
    pools.map(async (pool) => {
      const slip = sellPlan(pool, address, cfg.SLIPPAGE_BPS)
      const attack = sellPlan(pool, address, attackBps)
      const sellBound =
        slip.direction === "down"
          ? Math.min(slip.targetTick, attack.targetTick)
          : Math.max(slip.targetTick, attack.targetTick)
      const pump = pumpPlan(pool, address, cfg.PUMP_TARGET_BPS)
      const [sellPage, pumpPage] = await Promise.all([
        cachedTicks(cache, pool, slip.direction, sellBound),
        cachedTicks(cache, pool, pump.direction, pump.targetTick),
      ])
      sellPages.set(pool.id, sellPage)
      pumpPages.set(pool.id, pumpPage)
    })
  )

  const depth = sellableDepthForToken(address, pools, sellPages, cfg.SLIPPAGE_BPS, ethPriceUsd)
  const attack = sellableDepthForToken(address, pools, sellPages, attackBps, ethPriceUsd)
  const pump = pumpCostForToken(address, pools, pumpPages, cfg.PUMP_TARGET_BPS, ethPriceUsd)

  const safeCapUsd = depth.depthUsd * cfg.CAP_FRACTION
  const first = markets[0]!
  return {
    tokenAddress: address,
    symbol: first.token.symbol,
    decimals: first.token.decimals,
    priceUsd,
    depthStatus: classifyDepth(depth.depthUsd, cfg.SHALLOW_DEPTH_USD),
    sellableDepthUsd: depth.depthUsd,
    safeCapUsd,
    exposureUsd: exposure.exposureUsd,
    exposureRatio: exposureRatio(exposure.exposureUsd, safeCapUsd),
    liquidationAttackCostUsd: attack.depthUsd,
    pumpCostUsd: pump.costUsd,
    requiredDrop: exposure.requiredDrop,
    protocols: protocolsOf(markets),
    truncated: depth.truncated || attack.truncated || pump.truncated,
    pools: depth.perPool,
    markets,
    error: null,
    computedAt: new Date().toISOString(),
  }
}
