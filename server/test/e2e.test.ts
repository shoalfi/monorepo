import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Express } from "express"
import request from "supertest"

const dbDir = mkdtempSync(join(tmpdir(), "shoalfi-e2e-"))

process.env.DATABASE_PATH = join(dbDir, "e2e.sqlite")
process.env.GRAPH_API_KEY = "e2e-test-graph-key"
process.env.UNISWAP_V3_SUBGRAPH_ID = "e2e-test-uniswap-id"
process.env.LENDING_SOURCE = "messari"
process.env.MESSARI_AAVE_V3_SUBGRAPH_ID = "e2e-test-aave-id"
delete process.env.ANTHROPIC_API_KEY

// Dynamic imports: static imports resolve (and run) before this file's own
// top-level statements, which would read config/db before the env vars above
// are set. Deferring the import until after they're set keeps the test
// isolated from whatever is in the developer's real .env.
const { buildApp } = await import("../src/app")
const { initSchema, closeDb } = await import("../src/db/client")
const { upsertScore, recordRun } = await import("../src/db/repo")

const AAA = "0x1111111111111111111111111111111111111111"
const BBB = "0x2222222222222222222222222222222222222222"
const now = new Date()

let app: Express

beforeAll(async () => {
  await initSchema()

  // A deep, over-lent token: exposure ($9M) exceeds its safe cap ($6M).
  await upsertScore({
    tokenAddress: AAA,
    symbol: "AAA",
    decimals: 18,
    priceUsd: 1.5,
    depthStatus: "deep",
    sellableDepthUsd: 20_000_000,
    safeCapUsd: 6_000_000,
    exposureUsd: 9_000_000,
    exposureRatio: 1.5,
    liquidationAttackCostUsd: 4_000_000,
    pumpCostUsd: 3_000_000,
    requiredDrop: 0.2,
    protocols: ["aave-v3"],
    truncated: false,
    pools: [
      {
        poolId: "0xpool1",
        feeTier: 3000,
        pair: "AAA/WETH",
        direction: "down",
        depthUsd: 20_000_000,
        tvlUsd: 25_000_000,
        truncated: false,
      },
    ],
    markets: [
      {
        protocol: "aave-v3",
        marketId: "m1",
        marketName: "Aave v3 AAA",
        token: { address: AAA, symbol: "AAA", decimals: 18 },
        depositUsd: 12_000_000,
        maxLtv: 0.75,
        liquidationThreshold: 0.8,
      },
    ],
    error: null,
    computedAt: now.toISOString(),
  })

  // A token with no Uniswap v3 venue: depth is unknown, not zero.
  await upsertScore({
    tokenAddress: BBB,
    symbol: "BBB",
    decimals: 6,
    priceUsd: 1,
    depthStatus: "no_venue",
    sellableDepthUsd: null,
    safeCapUsd: null,
    exposureUsd: 500_000,
    exposureRatio: null,
    liquidationAttackCostUsd: null,
    pumpCostUsd: null,
    requiredDrop: 0.1,
    protocols: ["compound-v3"],
    truncated: false,
    pools: [],
    markets: [
      {
        protocol: "compound-v3",
        marketId: "m2",
        marketName: "Compound v3 BBB",
        token: { address: BBB, symbol: "BBB", decimals: 6 },
        depositUsd: 500_000,
        maxLtv: 0.6,
        liquidationThreshold: 0.7,
      },
    ],
    error: null,
    computedAt: now.toISOString(),
  })

  await recordRun({
    startedAt: new Date(now.getTime() - 5_000),
    finishedAt: now,
    durationMs: 5_000,
    lendingSource: "messari",
    marketCounts: { "aave-v3": 1, "compound-v3": 1 },
    ethPriceUsd: 2_500,
    uniswapBlock: 21_000_000,
    lendingBlock: 20_999_998,
    tokensTotal: 2,
    tokensScored: 2,
    tokensFailed: 0,
    notes: null,
  })

  app = await buildApp()
})

afterAll(async () => {
  closeDb()
  rmSync(dbDir, { recursive: true, force: true })
})

describe("GET /health", () => {
  test("reports ok, the last run, and the configured subgraphs", async () => {
    const res = await request(app).get("/health")
    expect(res.status).toBe(200)
    const body = res.body
    expect(body.ok).toBe(true)
    expect(body.lendingSource).toBe("messari")
    expect(body.lastRun.tokensScored).toBe(2)
    expect(body.lastRun.uniswapBlock).toBe(21_000_000)
    expect(body.subgraphs.map((s: { name: string }) => s.name)).toContain("uniswap-v3-ethereum")
  })
})

describe("GET /tokens", () => {
  test("defaults to exposure_ratio desc and excludes no_venue tokens", async () => {
    const res = await request(app).get("/tokens")
    expect(res.status).toBe(200)
    const rows = res.body
    expect(rows.map((r: { symbol: string }) => r.symbol)).toEqual(["AAA"])
    expect(rows[0].exposureRatio).toBe(1.5)
  })

  test("stamps every response with the live-data block header", async () => {
    const res = await request(app).get("/tokens")
    expect(res.headers["x-shoalfi-block"]).toBe("21000000")
    expect(typeof res.headers["x-shoalfi-refreshed-at"]).toBe("string")
  })

  test("include_unknown=1 also returns no_venue tokens", async () => {
    const res = await request(app).get("/tokens?include_unknown=1")
    const rows = res.body
    expect(rows.map((r: { symbol: string }) => r.symbol).sort()).toEqual(["AAA", "BBB"])
  })

  test("protocol filter narrows to that protocol's markets", async () => {
    const res = await request(app).get("/tokens?protocol=compound-v3&include_unknown=1")
    const rows = res.body
    expect(rows.map((r: { symbol: string }) => r.symbol)).toEqual(["BBB"])
  })

  test("min_exposure_usd filters out smaller exposures", async () => {
    const res = await request(app).get("/tokens?min_exposure_usd=1000000")
    const rows = res.body
    expect(rows.map((r: { symbol: string }) => r.symbol)).toEqual(["AAA"])
  })

  test("rejects an invalid limit with 400", async () => {
    const res = await request(app).get("/tokens?limit=not-a-number")
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("invalid query")
  })
})

describe("GET /tokens/:address", () => {
  test("returns the full record for a known token", async () => {
    const res = await request(app).get(`/tokens/${AAA}`)
    expect(res.status).toBe(200)
    const body = res.body
    expect(body.symbol).toBe("AAA")
    expect(body.pools).toHaveLength(1)
    expect(body.markets[0].protocol).toBe("aave-v3")
  })

  test("404s on an address with no score", async () => {
    const res = await request(app).get("/tokens/0x9999999999999999999999999999999999999999")
    expect(res.status).toBe(404)
  })

  test("400s on a malformed address", async () => {
    const res = await request(app).get("/tokens/not-an-address")
    expect(res.status).toBe(400)
  })
})

describe("POST /ask", () => {
  test("never 500s: falls back to the default ranking without an Anthropic key", async () => {
    const res = await request(app)
      .post("/ask")
      .send({ question: "which tokens are most over-lent relative to their liquidity?" })
    expect(res.status).toBe(200)
    const body = res.body
    expect(body.mode).toBe("fallback")
    expect(body.toolCalls).toEqual([])
    expect(body.rows.map((r: { symbol: string }) => r.symbol)).toEqual(["AAA"])
  })

  test("rejects a too-short question with 400", async () => {
    const res = await request(app).post("/ask").send({ question: "hi" })
    expect(res.status).toBe(400)
  })

  test("rejects a missing question with 400", async () => {
    const res = await request(app).post("/ask").send({})
    expect(res.status).toBe(400)
  })
})
