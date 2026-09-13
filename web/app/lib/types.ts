/**
 * Mirrors server/src/engine/types.ts. The backend is the source of truth and
 * must not change shape, so nothing here is renamed or invented: any field the
 * API cannot produce is null and renders as an em dash.
 */

export type RiskLevel = "green" | "amber" | "red" | "unknown"
export type DepthState = "deep" | "shallow" | "unknown"
export type LendingSchema = "messari-standardized" | "aave-official"

export interface Meta {
  chain: string
  block: number
  refreshedAt: string
  sources: { lending: string[]; dex: string[] }
  lendingSchema: LendingSchema
  /** Fraction of sellable depth a market may lend against — mirrors CapSteward.capBps. */
  capFraction: number
  /** Fraction the pump-attack direction targets, e.g. 1.0 means +100%. */
  pumpTargetPct: number
}

export interface Depth {
  state: DepthState
  sellableUsd10pct: number | null
  venue: string | null
  poolCount: number
}

export interface Exposure {
  depositsUsd: number | null
  maxLtv: number | null
  exposureUsd: number | null
}

export interface AttackCost {
  direction: "down" | "up"
  /** Fraction, not percent: 0.17 means a 17% move. */
  movePct: number
  costUsd: number
}

export interface Market {
  protocol: Protocol
  marketId: string
  marketName: string | null
  token: { address: string; symbol: string; decimals: number }
  depositUsd: number
  /** 0..1 */
  maxLtv: number
  /** 0..1 */
  liquidationThreshold: number
}

export interface PoolDepth {
  poolId: string
  feeTier: number
  pair: string
  direction: Direction
  depthUsd: number
  tvlUsd: number
  /** Tick walk hit the page cap; the remainder is extrapolated. */
  truncated: boolean
}

export interface TokenScore {
  tokenAddress: string
  symbol: string
  decimals: number
  priceUsd: number
  depthStatus: DepthStatus
  /** null when depthStatus === "no_venue" */
  sellableDepthUsd: number | null
  safeCapUsd: number | null
  exposureUsd: number
  exposureRatio: number | null
  /** USD of the token that must be sold to push its price down by requiredDrop */
  liquidationAttackCostUsd: number | null
  /** USD of quote tokens that must be spent to push the price up by PUMP_TARGET_BPS */
  pumpCostUsd: number | null
  /** 1 - deposit-weighted liquidation threshold */
  requiredDrop: number
  protocols: Protocol[]
  truncated: boolean
  pools: PoolDepth[]
  markets: Market[]
  /** Last scoring error for this token; stored numbers are stale when set. */
  error: string | null
  computedAt: string
}

/** Derived in the browser, not returned by the API. See deriveRisk(). */
export type RiskLevel = "green" | "amber" | "red" | "unknown"

export interface LastRun {
  startedAt: string
  finishedAt: string
  durationMs: number
  lendingSource: string
  marketCounts: Record<string, number>
  ethPriceUsd: number | null
  uniswapBlock: number | null
  lendingBlock: number | null
  tokensTotal: number
  tokensScored: number
  tokensFailed: number
  notes: string | null
}

export interface Health {
  ok: boolean
  lastRun: LastRun | null
  lendingSource: string
  subgraphs: { name: string; id: string }[]
  uptimeSec: number
}

/**
 * Header-level state for the dashboard, adapted from /health plus the
 * x-shoalfi-block header on /tokens. There is no /meta route.
 */
export interface Meta {
  block: number | null
  lendingBlock: number | null
  refreshedAt: string | null
  lendingSource: string
  subgraphs: { name: string; id: string }[]
  /** True when the service is up but no refresh has completed yet. */
  refreshing: boolean
}

export type AskMode = "connector" | "client" | "fallback"

export interface ToolCall {
  tool: string
  target: string
  /** Null when the model path gives no per-tool timing (the MCP connector path). */
  ms: number | null
}

export interface AskResponse {
  answer: string
  rows: TokenScore[]
  toolCalls: ToolCall[]
  mode: AskMode
  error?: string
}

// ---------------------------------------------------------------------------
// Backend DTOs — the shapes the server actually returns. `lib/adapt.ts` maps
// these onto the view-model types above; nothing else in the app should read
// these directly.

export type DepthStatusDTO = "deep" | "shallow" | "no_venue"
export type ProtocolDTO = "aave-v3" | "compound-v3" | "morpho-blue"

export interface MarketDTO {
  protocol: ProtocolDTO
  marketId: string
  marketName: string
  token: { address: string; symbol: string; decimals: number }
  depositUsd: number
  /** 0..1 */
  maxLtv: number
  /** 0..1 */
  liquidationThreshold: number
}

export interface PoolDepthDTO {
  poolId: string
  feeTier: number
  pair: string
  direction: "down" | "up"
  depthUsd: number
  tvlUsd: number
  truncated: boolean
}

export interface TokenScoreDTO {
  tokenAddress: string
  symbol: string
  decimals: number
  priceUsd: number
  depthStatus: DepthStatusDTO
  sellableDepthUsd: number | null
  safeCapUsd: number | null
  exposureUsd: number
  exposureRatio: number | null
  liquidationAttackCostUsd: number | null
  pumpCostUsd: number | null
  requiredDrop: number
  protocols: ProtocolDTO[]
  truncated: boolean
  pools: PoolDepthDTO[]
  markets: MarketDTO[]
  error: string | null
  computedAt: string
}

export interface ToolCallDTO {
  name: string
  argsSummary: string
  target: string
  ms: number | null
}

export interface AskResponseDTO {
  answer: string
  rows: TokenScoreDTO[]
  toolCalls: ToolCallDTO[]
  mode: "connector" | "client" | "fallback"
  usedMcp: boolean
  error?: string
}
