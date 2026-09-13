import Anthropic from "@anthropic-ai/sdk"
import {
  mcpTools,
  type MCPCallToolResultLike,
  type MCPClientLike,
} from "@anthropic-ai/sdk/helpers/beta/mcp"
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { z } from "zod"
import { configuredSubgraphs, env } from "../config"
import { log, errorMessage } from "../log"
import { getScores, listScores } from "../db/repo"
import type { TokenScore } from "../engine/types"

const MCP_SERVER_NAME = "subgraph"
const ALLOWED_TOOLS = [
  "execute_query_by_subgraph_id",
  "get_schema_by_subgraph_id",
  "search_subgraphs_by_keyword",
] as const

const FALLBACK_ANSWER = "Couldn't process that — showing markets by exposure ratio."
const MAX_TOKENS = 8192

export type ToolCall = { name: string; argsSummary: string; target: string; ms: number | null }
export type AskMode = "connector" | "client" | "fallback"
export type AskResponse = {
  answer: string
  rows: TokenScore[]
  toolCalls: ToolCall[]
  mode: AskMode
  usedMcp: boolean
  error?: string
}

let anthropicClient: Anthropic | null | undefined
function getAnthropic(): Anthropic | null {
  if (anthropicClient !== undefined) return anthropicClient
  anthropicClient = env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 120_000 })
    : null
  return anthropicClient
}

const money = (n: number | null) => (n === null ? null : Math.round(n))

function compactRow(s: TokenScore) {
  return {
    address: s.tokenAddress,
    symbol: s.symbol,
    depth_status: s.depthStatus,
    price_usd: Number(s.priceUsd.toPrecision(6)),
    sellable_depth_usd: money(s.sellableDepthUsd),
    safe_cap_usd: money(s.safeCapUsd),
    exposure_usd: money(s.exposureUsd),
    exposure_ratio: s.exposureRatio === null ? null : Number(s.exposureRatio.toFixed(3)),
    liquidation_attack_cost_usd: money(s.liquidationAttackCostUsd),
    pump_cost_usd: money(s.pumpCostUsd),
    required_drop: Number(s.requiredDrop.toFixed(3)),
    protocols: s.protocols,
  }
}

export function buildSystemPrompt(snapshot: TokenScore[]): string {
  const subgraphs = configuredSubgraphs()
    .map((s) => `- ${s.name}: ${s.id}`)
    .join("\n")
  const refreshed = snapshot[0]?.computedAt ?? "unknown"
  return `You are the analyst behind shoalfi, a liquidity-aware collateral risk monitor for Ethereum mainnet lending protocols. shoalfi values collateral by how much of it can actually be sold, not by spot price.

Field definitions (all USD unless noted):
- sellable_depth_usd: value of the token that can be sold on Uniswap v3 before its price falls ${env.SLIPPAGE_BPS / 100}%. Pools are summed independently (an upper bound).
- safe_cap_usd: ${Math.round(env.CAP_FRACTION * 100)}% of sellable_depth_usd, the most any protocol should lend against the token.
- exposure_usd: upper bound of what is currently borrowable against the token across indexed lending markets (deposits × max LTV, summed over markets).
- exposure_ratio: exposure_usd / safe_cap_usd. Above 1.0 means over-lent relative to real liquidity.
- liquidation_attack_cost_usd: value of the token that must be dumped to push its price down by required_drop (1 − deposit-weighted liquidation threshold), i.e. enough to make loans undercollateralized. The Morpho / PT-reUSD pattern.
- pump_cost_usd: value of quote tokens that must be spent buying the token to raise its price by ${env.PUMP_TARGET_BPS / 100}%. The Moonwell / MAMO pattern (inflate collateral, then borrow).
- depth_status: "deep" (depth ≥ $${env.SHALLOW_DEPTH_USD.toLocaleString("en-US")}), "shallow", or "no_venue" (no Uniswap v3 pool; depth is unknown, not zero, so depth-based fields are null).
- protocols: which lending protocols accept the token as collateral.

Current snapshot (top ${snapshot.length} tokens by exposure ratio, refreshed ${refreshed}):
${JSON.stringify(snapshot.map(compactRow))}

Subgraphs shoalfi reads (The Graph Network, Ethereum mainnet):
${subgraphs}

Answer ranking and comparison questions from the snapshot. When the user asks about live on-chain values that are not in the snapshot (for example the current liquidity or tick of a specific pool, or a specific market's deposits), use the subgraph tools to query one of the subgraph IDs above, and always state which subgraph you queried. Do not invent numbers.

Output contract: answer in at most 4 sentences of plain prose. Then output exactly one fenced \`\`\`json block containing {"token_addresses": [...]} with the lowercase addresses of every token you referenced (an empty array if none).`
}

const AddressList = z.object({
  token_addresses: z.array(z.string().regex(/^0x[0-9a-fA-F]{40}$/)).max(20),
})

export function splitAnswer(text: string): { answer: string; addresses: string[] } {
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)]
  const bare = [...text.matchAll(/\{[^{}]*"token_addresses"[\s\S]*?\}/g)]
  const candidates = [...fenced.map((m) => ({ full: m[0], json: m[1] ?? "" })), ...bare.map((m) => ({ full: m[0], json: m[0] }))]
  for (const c of candidates.reverse()) {
    try {
      const parsed = AddressList.safeParse(JSON.parse(c.json))
      if (parsed.success) {
        const answer = text.replace(c.full, "").trim()
        return { answer, addresses: parsed.data.token_addresses.map((a) => a.toLowerCase()) }
      }
    } catch {}
  }
  return { answer: text.trim(), addresses: [] }
}

type ModelOutcome = { text: string; toolCalls: ToolCall[]; stopReason: string | null }

function summarizeArgs(input: unknown): string {
  try {
    return JSON.stringify(input).slice(0, 200)
  } catch {
    return String(input).slice(0, 200)
  }
}

function targetFor(name: string, input: unknown): string {
  const subgraphId =
    input && typeof input === "object" && "subgraph_id" in input
      ? String((input as Record<string, unknown>).subgraph_id)
      : undefined
  const match = subgraphId ? configuredSubgraphs().find((s) => s.id === subgraphId) : undefined
  return match?.name ?? subgraphId ?? name
}

function collect(message: Anthropic.Beta.BetaMessage, toolCalls: ToolCall[]): string {
  let text = ""
  for (const block of message.content) {
    if (block.type === "text") text += block.text
    else if (block.type === "mcp_tool_use" || block.type === "tool_use") {
      toolCalls.push({
        name: block.name,
        argsSummary: summarizeArgs(block.input),
        target: targetFor(block.name, block.input),
        ms: null,
      })
    }
  }
  return text
}

type ToolTiming = { argsKey: string; ms: number }

function applyTimings(toolCalls: ToolCall[], timings: ToolTiming[]): void {
  for (const call of toolCalls) {
    const idx = timings.findIndex((t) => t.argsKey === call.argsSummary)
    if (idx >= 0) call.ms = timings.splice(idx, 1)[0]!.ms
  }
}

async function viaConnector(
  anthropic: Anthropic,
  system: string,
  question: string,
  useFallbacks = true
): Promise<ModelOutcome> {
  const configs = Object.fromEntries(ALLOWED_TOOLS.map((name) => [name, { enabled: true }]))
  try {
    const message = await anthropic.beta.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      betas: useFallbacks
        ? ["mcp-client-2025-11-20", "server-side-fallback-2026-07-01"]
        : ["mcp-client-2025-11-20"],
      ...(useFallbacks ? { fallbacks: "default" as const } : {}),
      output_config: { effort: "medium" },
      system,
      messages: [{ role: "user", content: question }],
      mcp_servers: [
        {
          type: "url",
          url: env.SUBGRAPH_MCP_URL,
          name: MCP_SERVER_NAME,
          authorization_token: env.GRAPH_API_KEY,
        },
      ],
      tools: [
        {
          type: "mcp_toolset",
          mcp_server_name: MCP_SERVER_NAME,
          default_config: { enabled: false },
          configs,
        },
      ],
    })
    const toolCalls: ToolCall[] = []
    const text = collect(message, toolCalls)
    return { text, toolCalls, stopReason: message.stop_reason }
  } catch (err) {
    if (useFallbacks && err instanceof Anthropic.BadRequestError && /fallback/i.test(err.message)) {
      log.warn("server-side fallbacks rejected by the API; retrying without them")
      return viaConnector(anthropic, system, question, false)
    }
    throw err
  }
}

function connectorUnavailable(err: unknown): boolean {
  if (err instanceof Anthropic.PermissionDeniedError) return true
  if (err instanceof Anthropic.BadRequestError) return /mcp/i.test(err.message)
  return false
}

async function connectMcp(): Promise<McpClient> {
  const headers = { Authorization: `Bearer ${env.GRAPH_API_KEY}` }
  const httpUrl = new URL(env.SUBGRAPH_MCP_URL.replace(/\/sse\/?$/, "/mcp"))
  const viaHttp = new McpClient({ name: "shoalfi", version: "0.0.1" })
  try {
    await viaHttp.connect(new StreamableHTTPClientTransport(httpUrl, { requestInit: { headers } }))
    return viaHttp
  } catch (err) {
    log.warn(`streamable HTTP MCP transport failed (${errorMessage(err)}); trying SSE`)
  }
  const viaSse = new McpClient({ name: "shoalfi", version: "0.0.1" })
  await viaSse.connect(
    new SSEClientTransport(new URL(env.SUBGRAPH_MCP_URL), {
      requestInit: { headers },
      eventSourceInit: {
        fetch: (url, init) =>
          fetch(url, {
            ...init,
            headers: { ...((init?.headers as Record<string, string> | undefined) ?? {}), ...headers },
          }),
      },
    })
  )
  return viaSse
}

async function viaClient(anthropic: Anthropic, system: string, question: string): Promise<ModelOutcome> {
  const mcp = await connectMcp()
  try {
    const { tools } = await mcp.listTools()
    const allowed = tools.filter((t) => (ALLOWED_TOOLS as readonly string[]).includes(t.name))
    const timings: ToolTiming[] = []
    const mcpClientForTools: MCPClientLike = {
      callTool: async (params) => {
        const start = performance.now()
        try {
          return (await mcp.callTool(params)) as MCPCallToolResultLike
        } finally {
          const args = (params as { arguments?: unknown })?.arguments
          timings.push({ argsKey: summarizeArgs(args), ms: Math.round(performance.now() - start) })
        }
      },
    }
    const runner = anthropic.beta.messages.toolRunner({
      model: env.ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: "medium" },
      system,
      messages: [{ role: "user", content: question }],
      tools: mcpTools(allowed, mcpClientForTools),
      max_iterations: 5,
    })
    const toolCalls: ToolCall[] = []
    let text = ""
    let stopReason: string | null = null
    for await (const message of runner) {
      text = collect(message, toolCalls)
      stopReason = message.stop_reason
    }
    applyTimings(toolCalls, timings)
    return { text, toolCalls, stopReason }
  } finally {
    await mcp.close().catch(() => {})
  }
}

async function defaultRows(): Promise<TokenScore[]> {
  return listScores({
    sort: "exposure_ratio",
    order: "desc",
    minExposureUsd: 0,
    includeUnknown: false,
    limit: 10,
  })
}

export async function fallbackResponse(reason: string): Promise<AskResponse> {
  const rows = await defaultRows().catch(() => [])
  return { answer: FALLBACK_ANSWER, rows, toolCalls: [], mode: "fallback", usedMcp: false, error: reason }
}

export async function ask(question: string): Promise<AskResponse> {
  const anthropic = getAnthropic()
  if (!anthropic) throw new Error("ANTHROPIC_API_KEY is not set")

  const snapshot = await listScores({
    sort: "exposure_ratio",
    order: "desc",
    minExposureUsd: 0,
    includeUnknown: true,
    limit: 60,
  })
  const system = buildSystemPrompt(snapshot)

  let outcome: ModelOutcome
  let mode: AskMode = "connector"
  try {
    outcome = await viaConnector(anthropic, system, question)
  } catch (err) {
    if (!connectorUnavailable(err)) throw err
    log.warn(`MCP connector unavailable (${errorMessage(err)}); using client-side MCP`)
    mode = "client"
    outcome = await viaClient(anthropic, system, question)
  }

  if (outcome.stopReason === "refusal") throw new Error("model declined the request")

  const { answer, addresses } = splitAnswer(outcome.text)
  let rows = await getScores(addresses)
  if (rows.length === 0) rows = await defaultRows()
  return {
    answer: answer || FALLBACK_ANSWER,
    rows,
    toolCalls: outcome.toolCalls,
    mode,
    usedMcp: outcome.toolCalls.length > 0,
  }
}
