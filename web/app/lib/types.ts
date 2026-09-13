/**
 * Mirrors the backend API contract exactly. Nothing here is invented: if a
 * field is absent from the contract it is absent from these types.
 *
 * Every numeric field the backend may not be able to compute is `number | null`
 * so the UI can render an em dash instead of a misleading zero.
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
  protocol: string
  marketId: string
  ltv: number | null
  liquidationThreshold: number | null
  depositsUsd: number | null
  borrowsUsd: number | null
}

export interface Token {
  address: string
  symbol: string
  name: string
  priceUsd: number | null
  depth: Depth
  safeCapUsd: number | null
  exposure: Exposure
  /** exposureUsd ÷ sellableUsd10pct. Null whenever depth is unknown. */
  ratio: number | null
  attackCost: AttackCost | null
  risk: RiskLevel
  markets: Market[]
}

export interface Pool {
  venue: string
  pool: string
  pair: string
  feeTier: number
  tvlUsd: number | null
  sellableUsd10pct: number | null
}

export interface TokenDetail extends Token {
  pools: Pool[]
  /** One plain-english sentence written by the backend. Never written here. */
  summary: string | null
}

export interface ToolCall {
  tool: string
  target: string
  /** Null when the model path gives no per-tool timing (the MCP connector path). */
  ms: number | null
}

export interface AskResponse {
  /** Markdown. */
  answer: string
  toolCalls: ToolCall[]
  usedMcp: boolean
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
