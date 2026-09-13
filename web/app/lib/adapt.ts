import type {
  AskResponse,
  AskResponseDTO,
  AttackCost,
  Meta,
  Pool,
  Token,
  TokenDetail,
  TokenScoreDTO,
  RiskLevel,
} from "@/lib/types"

export function toRiskLevel(ratio: number | null): RiskLevel {
  if (ratio === null) return "unknown"
  if (ratio >= 1) return "red"
  if (ratio >= 0.7) return "amber"
  return "green"
}

export function toAttackCost(score: TokenScoreDTO, meta: Meta): AttackCost | null {
  const down = score.liquidationAttackCostUsd
  const up = score.pumpCostUsd
  if (down === null && up === null) return null
  if (up === null || (down !== null && down <= up)) {
    return { direction: "down", movePct: score.requiredDrop, costUsd: down as number }
  }
  return { direction: "up", movePct: meta.pumpTargetPct, costUsd: up }
}

function depthState(status: TokenScoreDTO["depthStatus"]): "deep" | "shallow" | "unknown" {
  return status === "no_venue" ? "unknown" : status
}

export function toToken(score: TokenScoreDTO, meta: Meta): Token {
  const depositsUsd = score.markets.reduce((sum, m) => sum + m.depositUsd, 0)
  const maxLtv = depositsUsd > 0 ? score.exposureUsd / depositsUsd : null

  return {
    address: score.tokenAddress,
    symbol: score.symbol,
    name: score.symbol,
    priceUsd: score.priceUsd,
    depth: {
      state: depthState(score.depthStatus),
      sellableUsd10pct: score.sellableDepthUsd,
      venue: score.pools.length > 0 ? (meta.sources.dex[0] ?? null) : null,
      poolCount: score.pools.length,
    },
    safeCapUsd: score.safeCapUsd,
    exposure: {
      depositsUsd: depositsUsd > 0 ? depositsUsd : null,
      maxLtv,
      exposureUsd: score.exposureUsd,
    },
    ratio: score.exposureRatio,
    attackCost: toAttackCost(score, meta),
    risk: toRiskLevel(score.exposureRatio),
    markets: score.markets.map((m) => ({
      protocol: m.protocol,
      marketId: m.marketId,
      ltv: m.maxLtv,
      liquidationThreshold: m.liquidationThreshold,
      depositsUsd: m.depositUsd,
      borrowsUsd: null,
    })),
  }
}

export function toTokenDetail(score: TokenScoreDTO, meta: Meta): TokenDetail {
  const pools: Pool[] = score.pools.map((p) => ({
    venue: meta.sources.dex[0] ?? "uniswap-v3",
    pool: p.poolId,
    pair: p.pair,
    feeTier: p.feeTier,
    tvlUsd: p.tvlUsd,
    sellableUsd10pct: p.depthUsd,
  }))
  return {
    ...toToken(score, meta),
    pools,
    summary: null,
  }
}

export function toAskResponse(raw: AskResponseDTO): AskResponse {
  return {
    answer: raw.answer,
    usedMcp: raw.usedMcp,
    toolCalls: raw.toolCalls.map((call) => ({
      tool: call.name,
      target: call.target,
      ms: call.ms,
    })),
  }
}
