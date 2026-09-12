# shoalfi scanner (web/app)

The dashboard. For every collateral token in an indexed lending market it shows
how much could actually be sold on Uniswap v3 against how much has been lent
against it.

| Column | Source |
| --- | --- |
| token | `symbol`, with the protocols it appears in |
| price | `priceUsd` |
| sellable (10% move) | `sellableDepthUsd` — USD sellable before the price moves 10% |
| safe cap (30%) | `safeCapUsd` — 30% of sellable depth |
| lent against it | `exposureUsd` — Σ(`depositUsd` × `maxLtv`) across markets |
| ratio | `exposureRatio` = `exposureUsd ÷ safeCapUsd`, capped at 9999 |
| dump cost | `liquidationAttackCostUsd` — USD to push the price down past the liquidation threshold gap (the Morpho pattern) |
| pump cost (2×) | `pumpCostUsd` — USD of quote tokens to double the price (the Moonwell pattern) |
| risk | derived in the browser, see below |

A `~` prefix on sellable means the tick walk hit its page cap and the remainder
was extrapolated (`truncated`). A `stale` chip means `error` is set on that row,
so the numbers shown are the last good ones.

## Derived risk

The API returns no risk field. The scanner derives it in one pure function
(`deriveRisk` in `lib/api.ts`) and prints the rule in the page footnote, so
nothing implies the backend assigned it:

```
depthStatus === "no_venue" || exposureRatio === null  → unknown
exposureRatio > 1                                     → red
exposureRatio > 0.5                                   → amber
otherwise                                             → green
```

`no_venue` tokens are never mixed into the ranking. They sit below a divider,
because an unmeasured token is not a safe one.

## How it talks to the API

There is no `/meta` route, so header state is adapted from `/health`:
`lastRun.uniswapBlock` is the block, `lastRun.finishedAt` the refresh time, plus
`lendingSource` and `subgraphs`. When `lastRun` is null or `tokensScored` is 0
the pill says "refreshing", not "error".

The table requests `/tokens?limit=500&include_unknown=1`. The `include_unknown`
flag is required: the API drops `no_venue` rows by default and those are exactly
what the bottom group exists to show. Sorting, filtering and grouping happen
client-side.

`/tokens/:address` returns the same `TokenScore` shape as the list, pools and
markets included, so the drawer needs no second type.

`POST /ask` returns `{ answer, rows, toolCalls, mode }`. The MCP pill requires
`mode` to be `connector` or `client` **and** at least one tool call; a connector
answer with no tool calls says "answered from the live snapshot" instead, since
claiming MCP was queried when it was not would be false.

If a field is missing the UI renders an em dash. It never renders a zero in
place of an unknown.

## Running it

```sh
NEXT_PUBLIC_API_BASE=https://shoalfiserver-production.up.railway.app \
NEXT_PUBLIC_USE_FIXTURES=false \
bun run --cwd web/app dev
```

With no `NEXT_PUBLIC_API_BASE` the app reads `public/fixtures/*.json` and shows a
yellow "fixture data" pill on every page. Fixture symbols are `TEST*` so they
cannot be mistaken for live data, and `next.config.ts` fails any production
build that would ship them.

`?demo=1` hides the search box and filter chips and steps the table font up one
size for recording. `?token=0x…` deep-links a drawer open.

## AI tools used

Built with Claude Code (Claude Opus 4.5). It wrote this frontend end to end:
`lib/types.ts`, `lib/api.ts`, `lib/format.ts`, `lib/use-meta.ts`, every file in
`components/dashboard/`, `app/page.tsx`, `app/incident/page.tsx`, the fixtures
under `public/fixtures/`, and the build guard in `next.config.ts`. It also
rewrote `web/landing` to remove claims the code did not back. The backend in
`server/` was written separately.
