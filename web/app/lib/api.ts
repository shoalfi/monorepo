import { toAskResponse, toToken, toTokenDetail } from "@/lib/adapt"
import type { AskResponse, AskResponseDTO, Meta, Token, TokenDetail, TokenScoreDTO } from "@/lib/types"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? ""
const FORCE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES === "true"

export const usingFixtures: boolean = FORCE_FIXTURES || API_BASE === ""

export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = usingFixtures ? path : `${API_BASE}${path}`
  let response: Response
  try {
    response = await fetch(url, { ...init, headers: { accept: "application/json", ...init?.headers } })
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : "network request failed")
  }
  if (!response.ok) {
    const fallback = `${path} returned ${response.status} ${response.statusText}`.trim()
    let message = fallback
    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === "string" && body.error) message = body.error
    } catch {}
    throw new ApiError(message, response.status)
  }
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError(`${path} returned a response that was not json`)
  }
}

let cachedMeta: Promise<Meta> | null = null

export function getMeta(signal?: AbortSignal): Promise<Meta> {
  if (signal) return request<Meta>(usingFixtures ? "/fixtures/meta.json" : "/meta", { signal })
  if (!cachedMeta) {
    cachedMeta = request<Meta>(usingFixtures ? "/fixtures/meta.json" : "/meta").catch((error: unknown) => {
      cachedMeta = null
      throw error
    })
  }
  return cachedMeta
}

export async function getTokens(signal?: AbortSignal): Promise<Token[]> {
  if (usingFixtures) return request<Token[]>("/fixtures/tokens.json", { signal })
  const [scores, meta] = await Promise.all([
    request<TokenScoreDTO[]>("/tokens", { signal }),
    getMeta(),
  ])
  return scores.map((score) => toToken(score, meta))
}

export async function getToken(address: string, signal?: AbortSignal): Promise<TokenDetail> {
  if (!usingFixtures) {
    const [score, meta] = await Promise.all([
      request<TokenScoreDTO>(`/tokens/${address}`, { signal }),
      getMeta(),
    ])
    return toTokenDetail(score, meta)
  }
  try {
    return await request<TokenDetail>(`/fixtures/token-${address.toLowerCase()}.json`, { signal })
  } catch {
    const tokens = await getTokens(signal)
    const token = tokens.find((candidate) => candidate.address.toLowerCase() === address.toLowerCase())
    if (!token) throw new ApiError(`no fixture for token ${address}`)
    return { ...token, pools: [], summary: null }
  }
}

export async function postAsk(question: string, signal?: AbortSignal): Promise<AskResponse> {
  if (usingFixtures) {
    return request<AskResponse>("/fixtures/ask.json", { signal })
  }
  const raw = await request<AskResponseDTO>("/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  })
  if (raw.mode === "fallback" && raw.error) throw new ApiError(raw.error)
  return toAskResponse(raw)
}

export function explorerAddressUrl(address: string): string {
  return `https://etherscan.io/address/${address}`
}

export function explorerBlockUrl(block: number): string {
  return `https://etherscan.io/block/${block}`
}

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
