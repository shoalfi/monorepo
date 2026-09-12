# shoalfi

<img src="web/landing/public/logo.png" alt="shoalfi logo" width="128" height="128" />

**Know what your collateral is actually worth if you had to sell it.**
For every token that Aave v3 and Compound v3 accept as collateral, shoalfi asks:
if a protocol had to sell this collateral today, what would it actually get?

This document covers the backend API and Foundry contracts: the JSON API, the
natural-language `/ask` endpoint, and the `CapSteward` contract stub, all built
and verified as part of this work. Every number is fetched live from The Graph
Network at request time or on a five-minute refresh; there is no mocked,
cached, or fixture data on any code path. The repository also contains a
scanner and landing frontend (`web/app`, `web/landing`), built and maintained
separately by the team — see their own READMEs for what they cover.

## The problem

In late August 2026 three lending protocols were drained or damaged because they
valued collateral by spot price instead of by how much of it could be sold:
Moonwell on Base lost about $8.7M after MAMO was pumped 8× across two thin pools
(27 Aug), Morpho saw about $36.4M of liquidations after roughly $320K of trades in
a Pendle pool holding about $9M of liquidity moved a PT-reUSD oracle against
$67.5M of collateral (25 Aug), and Tectonic on Cronos lost about $75M (30 Aug).
Sources and numbers are in [docs/mamo-case-study.md](docs/mamo-case-study.md).

## What it computes

| Field | Definition |
|---|---|
| `sellable_depth_usd` | USD value of the token that can be sold on Uniswap v3 before its price falls 10% |
| `safe_cap_usd` | 30% of `sellable_depth_usd`: the most any protocol should lend against it |
| `exposure_usd` | Upper bound of USD currently borrowable against the token across indexed lending markets (`deposits × maxLTV`, summed over markets) |
| `exposure_ratio` | `exposure_usd / safe_cap_usd`; above 1.0 means over-lent relative to real liquidity |
| `liquidation_attack_cost_usd` | USD of the token that must be dumped to move its price down by `1 − liquidation threshold` (the Morpho pattern) |
| `pump_cost_usd` | USD of quote tokens that must be spent to raise the token's price 2× (the Moonwell pattern) |
| `depth_status` | `deep`, `shallow` (below $5M of depth), or `no_venue` (no Uniswap v3 pool; depth is unknown, not zero, and depth-based fields are `null`) |

The 10%, 30%, 2× and $5M thresholds are `SLIPPAGE_BPS`, `CAP_FRACTION`,
`PUMP_TARGET_BPS` and `SHALLOW_DEPTH_USD` in `.env`.

## How it works

```
The Graph Network (Subgraph Studio API key)
 ├─ Messari standardized lending subgraphs  ─┐
 │    aave-v3-ethereum, compound-v3-ethereum │   server/src/collector/lending*.ts
 │    (optional: morpho-blue-ethereum)       ├──► Market[] (token, deposits, LTV, LT)
 └─ Uniswap v3 Ethereum subgraph ────────────┘   server/src/collector/uniswap.ts
      bundle, pools, ticks                    ──► Pool[], Tick[]
                                                      │
                          server/src/engine/depth.ts  ▼  tick walk (v3-sdk math)
                          server/src/engine/risk.ts   ▼  exposure, ratio, attack costs
                                                      │
                                 SQLite file in server/data/ (token_scores, refresh_runs)
                                                      │
                        Fastify: GET /health  GET /tokens  GET /tokens/:address
                                 POST /ask ──► Claude + The Graph Subgraph MCP
                                               (live subgraph queries on demand)
```

A refresh runs on boot and then on `REFRESH_CRON` (every five minutes by default).
Each run fetches every collateral market, walks the top Uniswap v3 pools for
every distinct collateral token, and upserts one row per token.

## The Graph integration

shoalfi composes two Graph products: **standardized subgraphs** queried directly,
and the **Subgraph MCP** used by the `/ask` endpoint.

**Subgraphs (Ethereum mainnet, The Graph Network).** IDs are configured in `.env`;
`bun run --cwd server probe` verifies each one against the mainnet head and
writes the result to [docs/data-sources.md](docs/data-sources.md), which also
records the `LENDING_SOURCE` decision.

| Subgraph | ID | Used for |
|---|---|---|
| Uniswap v3 Ethereum | [`5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`](https://thegraph.com/explorer/subgraphs/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV) | ETH price, pools, ticks |
| Messari aave-v3-ethereum | [`JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk`](https://thegraph.com/explorer/subgraphs/JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk) | collateral markets |
| Messari compound-v3-ethereum | [`AwoxEZbiWLvv6e3QdvdMZw4WDURdGbvPfHmZRc8Dpfz9`](https://thegraph.com/explorer/subgraphs/AwoxEZbiWLvv6e3QdvdMZw4WDURdGbvPfHmZRc8Dpfz9) | collateral markets |
| Aave v3 official (fallback when Messari is unhealthy) | [`Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g`](https://thegraph.com/explorer/subgraphs/Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g) | collateral markets |
| Morpho Blue (optional, Messari schema) | [`8Lz789DP5VKLXumTMTgygjU2xtuzx8AhbaacgN5PYCAs`](https://thegraph.com/explorer/subgraphs/8Lz789DP5VKLXumTMTgygjU2xtuzx8AhbaacgN5PYCAs) | collateral markets, only if the probe finds it indexed |

The lending collectors share one `Market` shape because the Messari lending
schema is the same across protocols: one query
([lending.messari.ts](server/src/collector/lending.messari.ts)) covers Aave v3,
Compound v3 and Morpho Blue; only the subgraph ID changes. The official Aave
subgraph needs its own collector ([lending.aave.ts](server/src/collector/lending.aave.ts))
because its field names and units differ. The gateway client with timeout and
retry is [graph.ts:34](server/src/collector/graph.ts#L34).

**Subgraph MCP.** `POST /ask` sends the question to Claude through the Anthropic
Messages API MCP connector with The Graph's Subgraph MCP server
(`https://subgraphs.mcp.thegraph.com/sse`) attached, allowlisting
`execute_query_by_subgraph_id`, `get_schema_by_subgraph_id` and
`search_subgraphs_by_keyword` ([ask.ts:165](server/src/routes/ask.ts#L165)). The
system prompt carries the current snapshot and the subgraph IDs above; when a
question needs a live value that is not in the snapshot, the model queries the
subgraph and the response's `toolCalls` lists every MCP call it made. If the
connector is unavailable the route falls back to a client-side MCP connection
with the same tools ([ask.ts:229](server/src/routes/ask.ts#L229)), and if
anything fails it still returns 200 with the default ranking (`mode: "fallback"`).

Track: **Best AI Tooling or AI Use Case with The Graph (From Scratch)**. The
build also matches the composable track's description (standardized lending
schema across protocols plus a layered MCP), but this project is entered in the
AI Tooling / AI Use Case (From Scratch) track only.

## Uniswap integration

- Pools and ticks come from the Uniswap v3 Ethereum subgraph:
  [`fetchPoolsForToken`](server/src/collector/uniswap.ts#L78) (top pools by TVL on
  either side of the token) and [`fetchTicks`](server/src/collector/uniswap.ts#L109)
  (initialized ticks between the current tick and the target, cursor-paginated).
- The tick walk uses `@uniswap/v3-sdk`: `TickMath.getSqrtRatioAtTick`,
  `SqrtPriceMath.getAmount0Delta`, `SqrtPriceMath.getAmount1Delta` with `jsbi`.
  [`walkPool`](server/src/engine/depth.ts#L80) walks from the pool's `sqrtPrice`
  to a target tick, crossing initialized ticks and adjusting liquidity by
  `liquidityNet`; [`sellPlan`](server/src/engine/depth.ts#L46) and
  [`pumpPlan`](server/src/engine/depth.ts#L54) pick the direction and the token
  flowing in; [`tickForPriceRatio`](server/src/engine/depth.ts#L26) turns a price
  move into a target tick.
- Depth per token sums its pools ([`sellableDepthForToken`](server/src/engine/depth.ts#L153));
  the pump cost values the quote token spent ([`pumpCostForToken`](server/src/engine/depth.ts#L196)).
- Unit tests check the walker against the closed-form single-range formulas in
  both directions ([server/test/depth.test.ts](server/test/depth.test.ts)).

What was easy, what was surprising, and what we would ask Uniswap for is in
[FEEDBACK.md](FEEDBACK.md).

## Running it

Requirements: [Bun](https://bun.sh) 1.3+, a
[Subgraph Studio API key](https://thegraph.com/studio/apikeys/), and optionally an
Anthropic API key for `/ask`. Storage is a SQLite file created automatically at
`server/data/shoalfi.sqlite` (via Bun's built-in `bun:sqlite`) — no database to
install or run separately.

```sh
bun install
cp .env.example .env          # fill GRAPH_API_KEY, ANTHROPIC_API_KEY
bun run --cwd server probe    # verifies the subgraphs, writes docs/data-sources.md
bun run dev:server            # API on http://localhost:4000, first refresh starts at boot
```

The first refresh takes one to three minutes depending on the Graph plan.
`GET /health` shows `lastRun` once it finishes. Free-plan keys should set
`REFRESH_CRON=*/30 * * * *` and `MAX_TICK_PAGES_PER_POOL=3`.

Other server scripts: `bun run --cwd server probe:collect` (market counts and
WETH pools), `bun run --cwd server probe:depth <token>` (depth and pump cost
for one token), `bun test:server`, `bun test:e2e`, `bun typecheck`, `bun contracts:test`.

The frontends (`web/app` the scanner, `web/landing` the marketing site) run with
`bun dev` (port 3000) and `bun dev:landing` (port 3001); `bun run build` and
`bun lint` cover both. They were initialized with `bunx --bun shadcn@latest init
@coss/style` and use the coss UI kit — see [web/app/README.md](web/app/README.md)
and [web/landing/README.md](web/landing/README.md).

### API

| Route | Notes |
|---|---|
| `GET /health` | `{ ok, lastRun: { finishedAt, uniswapBlock, lendingBlock, marketCounts, ... }, lendingSource, subgraphs }` |
| `GET /tokens` | `sort` ∈ `exposure_ratio` (default), `exposure_usd`, `sellable_depth_usd`, `safe_cap_usd`, `liquidation_attack_cost_usd`, `pump_cost_usd`, `price_usd`; `order`, `min_exposure_usd`, `protocol`, `include_unknown=1` (adds `no_venue` rows), `limit` |
| `GET /tokens/:address` | one token, 404 if unknown |
| `POST /ask` `{ "question": "..." }` | `{ answer, rows, toolCalls: [{ name, argsSummary }], mode }`, never 500 |

Every `/tokens` response carries `x-shoalfi-block` (the Uniswap subgraph block
the numbers were computed from) and `x-shoalfi-refreshed-at`, so a client —
including the scanner frontend — can show exactly how live the data is.

### Hosted API

| | |
| --- | --- |
| API | <https://shoalfiserver-production.up.railway.app> |
| Health | <https://shoalfiserver-production.up.railway.app/health> |
| CapSteward (Sepolia) | [`0x7Ec8Ee63f9eE8C9Fc1F6aC126575adf0E3e6431E`](https://sepolia.etherscan.io/address/0x7Ec8Ee63f9eE8C9Fc1F6aC126575adf0E3e6431E) |
| DepthOracle (Sepolia) | [`0x4655a18d3b3cF9644B90f633dbA030EAB12FF167`](https://sepolia.etherscan.io/address/0x4655a18d3b3cF9644B90f633dbA030EAB12FF167) |
| Scanner | see `NEXT_PUBLIC_API_BASE` in [web/app/.env.example](web/app/.env.example) |

Deployed on Railway (Bun, `bun run --cwd server start`, `/health` check); the
Graph key stays server-side. Because storage is a local SQLite file, the Railway
service needs a volume mounted at `server/data` (Railway dashboard → Volumes) so
scores survive a redeploy; without one every deploy starts with an empty
database and rebuilds it on the next refresh.

Every `/tokens` response carries the block the numbers were computed at:

```sh
curl -si "https://shoalfiserver-production.up.railway.app/tokens?limit=1" \
  | grep -i '^x-shoalfi'
# x-shoalfi-block: 25963542
# x-shoalfi-refreshed-at: 2026-09-12T19:51:43.911Z
```

## Known simplifications

- **Exposure is an upper bound.** `deposits × maxLTV` assumes every depositor
  borrows the maximum; real borrows are lower.
- **Pools are summed independently.** Selling into several pools at once shares
  arbitrage flow between them, so the true depth is somewhat lower.
- **Uniswap v3-only depth.** Curve, Balancer, Pendle, Uniswap v4 and centralised
  venues are not counted. Tokens with no v3 pool are reported as `no_venue`
  (depth unknown), not as zero depth, and are excluded from the ratio ranking
  unless `include_unknown=1` is passed.
- **Ethereum mainnet only.**
- **Data freshness.** Every number comes from the block reported in
  `x-shoalfi-block`; the refresh job re-runs on `REFRESH_CRON`, so a row is at
  most one refresh interval old.
- **Depth is valued at the pre-move price**, which slightly overstates USD proceeds.
- **Ticks are capped** at `MAX_TICK_PAGES_PER_POOL × 1000` per pool per direction;
  when the cap is hit the remaining range is extrapolated with the last known
  liquidity and the row is marked `truncated`.

## Roadmap

- **CapSteward** ([contracts/](contracts/README.md)): an on-chain cap that turns a
  depth snapshot into `maxBorrowableUsd(token)`. Deployed and verified on
  Sepolia and reading a real snapshot, but on no mainnet, unaudited, and no
  lending market consumes it. A production feed also needs signatures, a
  multi-reporter median and a dispute window; `DepthOracle` has none of these.
- Multi-chain (Base first) and Uniswap v4 pools; for MAMO-style tokens the label
  must say which venues are included, since MAMO's liquidity was split between
  Aerodrome Slipstream and Uniswap v4.
- Curve and Balancer depth for LSTs and stablecoins.
- A Chainlink CRE confidential workflow that applies private per-protocol
  thresholds to the public depth feed.

## AI tools used

Every file in `server/`, `contracts/` (except the vendored `contracts/lib/forge-std`),
and this README's backend/contracts content was written with Claude Code
(Claude Sonnet 5 and Claude Fable 5.1) working from a written specification,
with the tick-walk math, subgraph field names, and Anthropic API shapes
verified against primary sources during implementation. Human review covered
the spec, the design decisions recorded in the commit history, and the
acceptance checks (probe output, WETH depth sanity check, unit, e2e, and
Foundry tests). `web/app` and `web/landing` are maintained separately by the
team; see their own READMEs for their own AI-tool disclosure, if any.

## Sources

- The Defiant, Moonwell / MAMO: <https://thedefiant.io/news/hacks/moonwell-loses-8-7-million-to-mamo-price-manipulation-on-base>
- Moonwell post-mortem (source of the $11,028,762 borrowed figure): <https://forum.moonwell.fi/t/post-mortem-mamo-market-incident-on-base/2208>
- CryptoTicker, Moonwell / MAMO: <https://cryptoticker.io/en/moonwell-mamo-oracle-exploit-base/>
- CoinDesk, Tectonic / Cronos halt: <https://www.coindesk.com/tech/2026/08/31/cronos-halts-blockchain-after-usd75-million-lending-exploit-hits-lending-app-tectonic>
- CryptoTimes, Tectonic / 100x TONIC pump: <https://www.cryptotimes.io/2026/08/31/cronos-halts-entire-blockchain-after-75m-tectonic-exploit-only-6m-escapes/>
- CryptoTicker, Tectonic / Cronos chain halt: <https://cryptoticker.io/en/cronos-chain-halt-tectonic-exploit/>
- Crypto Briefing, Morpho / PT-reUSD trigger: <https://cryptobriefing.com/morpho-liquidations-pendle-reusd-cascade/>
- CryptoTimes, Morpho TWAP exploit: <https://www.cryptotimes.io/2026/08/25/morphos-15-minute-twap-oracle-exploited-in-36-4m-liquidation-attack/>
- CryptoDaily, Morpho market and pool figures: <https://cryptodaily.co.uk/2026/08/pt-reusd-morpho-liquidations-36m>
- The Graph, Subgraph MCP: <https://thegraph.com/docs/en/subgraphs/subgraph-mcp/introduction/>
- Anthropic, MCP connector: <https://platform.claude.com/docs/en/agents-and-tools/mcp-connector>
- Uniswap v3 SDK: <https://docs.uniswap.org/sdk/v3/overview>

## Repository layout and provenance

```text
shoalfi/
├── web/
│   ├── landing/  # Landing frontend (Next.js + coss ui)
│   └── app/      # Scanner frontend (web/app) (Next.js + coss ui)
├── server/       # Bun + Fastify API, collectors, depth engine, refresh job, tests
├── contracts/    # Foundry: CapSteward + DepthOracle (deployed to Sepolia), tests
├── deployments/  # Deployed addresses and transaction hashes
├── docs/         # data-sources.md (generated by the probe), mamo-case-study.md
├── package.json  # Bun workspaces and root commands
├── bun.lock
└── README.md
```

This repository's first commits (2026-09-06) scaffolded an unrelated idea
("Rivlet"). It was rebranded in place rather than restarted: the frontend
(`web/app`, `web/landing`) was renamed and rebuilt for shoalfi by the team,
and the backend, contracts, and docs described in this README were built
separately and merged in alongside it.

## License

[MIT](LICENSE)
