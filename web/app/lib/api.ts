import type { AskResponse, Health, Meta, RiskLevel, TokenScore } from "@/lib/types"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? ""
const FORCE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES === "true"

/**
 * Fixtures are used when explicitly switched on, or whenever no API base is
 * configured. Everything that renders data reads this flag and shows the
 * yellow "fixture data" pill.
 */
export const usingFixtures: boolean = FORCE_FIXTURES || API_BASE === ""

/** Matches RATIO_CAP in server/src/engine/risk.ts. */
export const RATIO_CAP = 9999

export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; response: Response }> {
  const url = usingFixtures ? path : `${API_BASE}${path}`
  let response: Response
  try {
    response = await fetch(url, { ...init, headers: { accept: "application/json", ...init?.headers } })
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : "network request failed")
  }
  if (!response.ok) {
    // The api returns { error, issues? } on 4xx; prefer that text over the status line.
    const detail = await response
      .clone()
      .json()
      .then((body: unknown) =>
        body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : null,
      )
      .catch(() => null)
    throw new ApiError(detail ?? `${path} returned ${response.status} ${response.statusText}`.trim(), response.status)
  }
  try {
    return { data: (await response.json()) as T, response }
  } catch {
    throw new ApiError(`${path} returned a response that was not json`)
  }
}

/**
 * There is no /meta route. Header state is adapted from /health, whose
 * lastRun carries the block and refresh time.
 */
export async function getMeta(signal?: AbortSignal): Promise<Meta> {
  const { data } = await request<Health>(usingFixtures ? "/fixtures/health.json" : "/health", { signal })
  const run = data.lastRun
  return {
    block: run?.uniswapBlock ?? null,
    lendingBlock: run?.lendingBlock ?? null,
    refreshedAt: run?.finishedAt ?? null,
    lendingSource: data.lendingSource,
    subgraphs: data.subgraphs ?? [],
    // Service is up but the first refresh has not landed: not an error state.
    refreshing: run === null || run.tokensScored === 0,
  }
}

/**
 * include_unknown=1 is required: the api excludes no_venue rows by default,
 * and those are exactly the tokens the bottom group exists to show.
 */
export async function getTokens(signal?: AbortSignal): Promise<TokenScore[]> {
  const { data } = await request<TokenScore[]>(
    usingFixtures ? "/fixtures/tokens.json" : "/tokens?limit=500&include_unknown=1",
    { signal },
  )
  return data
}

/** /tokens/:address returns the same TokenScore shape; there is no detail type. */
export async function getToken(address: string, signal?: AbortSignal): Promise<TokenScore> {
  if (!usingFixtures) {
    const { data } = await request<TokenScore>(`/tokens/${address}`, { signal })
    return data
  }
  try {
    const { data } = await request<TokenScore>(`/fixtures/token-${address.toLowerCase()}.json`, { signal })
    return data
  } catch {
    const tokens = await getTokens(signal)
    const token = tokens.find((candidate) => candidate.tokenAddress.toLowerCase() === address.toLowerCase())
    if (!token) throw new ApiError(`no fixture for token ${address}`)
    return token
  }
}

export async function postAsk(question: string, signal?: AbortSignal): Promise<AskResponse> {
  if (usingFixtures) {
    const { data } = await request<AskResponse>("/fixtures/ask.json", { signal })
    return data
  }
  const { data } = await request<AskResponse>("/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  })
  return data
}

/**
 * Risk is derived in the browser: the api does not return a risk field.
 * The rule is printed in the footnote so the ui never implies the backend
 * assigned these bands.
 *
 * exposureRatio is exposureUsd / safeCapUsd, where safeCap is 30% of sellable
 * depth. So 1.0 means a market has lent exactly the safe cap.
 */
export function deriveRisk(token: TokenScore): RiskLevel {
  if (token.depthStatus === "no_venue" || token.exposureRatio === null) return "unknown"
  if (token.exposureRatio > 1) return "red"
  if (token.exposureRatio > 0.5) return "amber"
  return "green"
}

export function explorerAddressUrl(address: string): string {
  return `https://etherscan.io/address/${address}`
}

export function explorerBlockUrl(block: number): string {
  return `https://etherscan.io/block/${block}`
}

/**
 * Market pages for the protocols we can link deterministically. Anything else
 * falls back to the block explorer rather than guessing a url shape.
 */
export function marketUrl(protocol: string, marketId: string): string {
  switch (protocol) {
    case "aave-v3":
      return `https://app.aave.com/reserve-overview/?underlyingAsset=${marketId}&marketName=proto_mainnet_v3`
    case "morpho-blue":
      return `https://app.morpho.org/market?id=${marketId}`
    default:
      return explorerAddressUrl(marketId)
  }
}
