import { graphQuery } from "./graph"
import { log } from "../log"
import type { Market, Protocol } from "../engine/types"

/**
 * Messari standardized lending schema (used by aave-v3, compound-v3 and
 * morpho-blue subgraphs). One `Market` per collateral asset per protocol.
 * `maximumLTV` and `liquidationThreshold` are percentages (80 = 80%).
 */
type RawMarket = {
  id: string
  name: string
  inputToken: { id: string; symbol: string; decimals: string | number }
  totalDepositBalanceUSD: string
  maximumLTV: string
  liquidationThreshold: string
}

const PAGE = 1000
// The gateway rejects skip values above 5000; collateral markets never get close.
const MAX_SKIP = 5000

const QUERY = `query Markets($first: Int!, $skip: Int!) {
  markets(
    first: $first
    skip: $skip
    where: { canUseAsCollateral: true, isActive: true }
    orderBy: totalDepositBalanceUSD
    orderDirection: desc
  ) {
    id
    name
    inputToken { id symbol decimals }
    totalDepositBalanceUSD
    maximumLTV
    liquidationThreshold
  }
}`

export async function fetchMessariMarkets(
  subgraphId: string,
  protocol: Protocol,
  minDepositUsd: number
): Promise<Market[]> {
  const markets: Market[] = []
  let rawTotal = 0
  let skippedByDeposit = 0
  for (let skip = 0; skip <= MAX_SKIP; skip += PAGE) {
    const data = await graphQuery<{ markets: RawMarket[] }>(subgraphId, QUERY, {
      first: PAGE,
      skip,
    })
    rawTotal += data.markets.length
    for (const m of data.markets) {
      const depositUsd = Number(m.totalDepositBalanceUSD)
      if (!Number.isFinite(depositUsd) || depositUsd < minDepositUsd) {
        skippedByDeposit++
        continue
      }
      markets.push({
        protocol,
        marketId: m.id.toLowerCase(),
        marketName: m.name,
        token: {
          address: m.inputToken.id.toLowerCase(),
          symbol: m.inputToken.symbol,
          decimals: Number(m.inputToken.decimals),
        },
        depositUsd,
        maxLtv: Number(m.maximumLTV) / 100,
        liquidationThreshold: Number(m.liquidationThreshold) / 100,
      })
    }
    if (data.markets.length < PAGE) break
  }
  if (rawTotal === 0) {
    log.warn(
      `messari subgraph ${subgraphId} (${protocol}): the where:{canUseAsCollateral,isActive} filter matched 0 markets — the subgraph itself has no such rows`
    )
  } else if (markets.length === 0) {
    log.warn(
      `messari subgraph ${subgraphId} (${protocol}): ${rawTotal} eligible markets found, all ${skippedByDeposit} below MIN_MARKET_DEPOSIT_USD=${minDepositUsd}`
    )
  }
  return markets
}
