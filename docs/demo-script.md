# shoalfi — demo script

ETHOnline 2026. Target runtime **3:00**. Numbers verified against the live API at
Ethereum mainnet block **25963732**.

> Narration is a guide, not a teleprompter. The **scenes, the order and the
> numbers** are what matter. Every figure below is real; if a number on screen
> disagrees with this page, trust the screen and say the number you see.

---

## The one-sentence pitch

> Lending markets price collateral by what it trades at. shoalfi prices it by how
> much you could actually sell — and shows you every market where those two
> numbers disagree.

## What we are entering

| Track | What actually backs it |
| --- | --- |
| **The Graph — Best AI Tooling / AI Use Case (From Scratch)** | Two Graph products composed: standardized Messari subgraphs queried directly for lending markets, and the **Subgraph MCP** behind `/ask` so the data can be questioned in plain english. |
| **Uniswap** | Depth is not a TVL proxy. We walk **Uniswap v3 ticks** with `@uniswap/v3-sdk` (`TickMath`, `SqrtPriceMath`) to compute how much USD actually clears before a 10% move. Written-up feedback in [FEEDBACK.md](../FEEDBACK.md). |

Weave these into scenes 3 and 6 rather than reading them as a list.

---

## Pre-flight (5 minutes before recording)

```sh
# 1. Data is fresh and non-empty
curl -s https://shoalfiserver-production.up.railway.app/health \
  | jq -c '{scored:.lastRun.tokensScored, markets:.lastRun.marketCounts, block:.lastRun.uniswapBlock}'
# want: scored > 100, both protocols present
```

- Set `REFRESH_CRON=*/30` on Railway. A rate-limited refresh mid-take blanks the table.
- Browser 1920×1080, zoom 100%, **one clean tab**, no bookmarks bar.
- Open `app.shoalfi.xyz/?demo=1`, hard-refresh, confirm the pill is **green**.
- Pre-open in background tabs: `/incident`, the Sepolia Etherscan **Read Contract** page.
- Run the ask question once so the model is warm.

---

## Scene 1 — the problem · `/incident` · 0:00–0:25

**Screen:** `app.shoalfi.xyz/incident`, slow scroll across the three cards.

> "Last week of August 2026. Moonwell lost 8.7 million dollars. Morpho saw 36.4
> million of liquidations triggered by about 320 thousand dollars of trades.
> Tectonic lost 75 million and Cronos halted the entire chain.
>
> None of these were hacks. No contract was broken. The oracle reported the
> correct market price every single time. The protocol just never asked how much
> of that collateral could actually be sold."

Land on the closing line of the page as you say it. Every card has live source links.

## Scene 2 — the idea · 0:25–0:40

**Screen:** cut to `app.shoalfi.xyz/?demo=1`.

> "shoalfi asks that one question, for every collateral token in a lending market.
> How much could you really sell right now — and how much has been lent against it."

Point at the header pill.

> "This is live. Block 25,963,732. Compound v3 and Morpho Blue collateral, depth
> from Uniswap v3 pool ticks, all through The Graph."

## Scene 3 — the table · 0:40–1:25 · **Uniswap + Graph beat**

**Screen:** full table. Hover the `sellable (10% move)` header, then `ratio`.

> "Sellable is the USD you could offload before the price moves ten percent. Not
> TVL, not volume — we walk the actual Uniswap v3 tick liquidity with their SDK
> and count what clears. Safe cap is thirty percent of that. Ratio is what's lent
> divided by that safe cap, so one-point-zero means a market has lent exactly as
> much as it should."

Scroll to **WBTC**, hover the row.

> "Wrapped Bitcoin. Four hundred and twelve million dollars lent against it across
> these markets. Twenty-nine million could be sold into a ten percent move. That's
> a forty-seven times gap."

Then contrast:

> "And USDC sits at 0.02 — green. This isn't a tool that paints everything red."

⚠️ **Do not lead with the top two rows.** `sUSDe` (ratio 4841) and `COMP` (1503)
are driven by sellable depths of \$1,167 and \$4,226, which are almost certainly
understated by our tick walk. If they're on screen, name it first:
*"top couple of rows have depth numbers I don't trust yet — let me use WBTC."*
Owning it beats being caught.

## Scene 4 — the drawer · 1:25–1:50

**Screen:** click the **WBTC** row. URL becomes `?token=0x2260…`.

> "Every number is traceable."

Scroll the pools table, then expand **the math**.

> "These are the Uniswap v3 pools we walked, each one linking to Etherscan. The
> lending markets with their deposits and LTVs. And the arithmetic, end to end:
> sellable times thirty percent is the safe cap, deposits times max LTV summed
> across markets is the exposure, exposure over safe cap is the ratio. No black box."

Press **Esc**.

## Scene 5 — the unknown group · 1:50–2:20 · **strongest beat**

**Screen:** scroll to the divider row.

> "A hundred and three of these tokens have no Uniswap v3 pool at all."

Point at **sFRAX** (\$32.3M lent), then find **PT-reUSD-10DEC2026**.

> "Thirty-two million dollars lent against sFRAX, and we can't measure it. Every
> column is a dash — not a zero.
>
> And here. PT-reUSD, on Morpho Blue, live right now, nine hundred thousand dollars
> lent against it, depth unknown. That is the same token family that caused the
> 36-million-dollar liquidation cascade three weeks ago — the second card on our
> incidents page.
>
> We don't call this safe. We call it unmeasured, and we refuse to rank it. A zero
> here would be a lie, and that lie is exactly what got Morpho."

## Scene 6 — ask · 2:20–2:40 · **Graph MCP beat**

**Screen:** scroll up, click preset 2.

> "Same live data, asked in english, through The Graph's Subgraph MCP."

Let it render, read the first line.

> "Fourteen tokens have more lent against them than their safe cap allows."

Click a token symbol in the answer — it opens that drawer.

⚠️ The pill usually reads **"answered from the live snapshot"**, not the MCP one.
`mode` is `connector` but `toolCalls` comes back empty, because the model answers
from the snapshot in its prompt. **We never fake that pill.** To show a real MCP
call, ask something the snapshot cannot answer:
*"what is the current liquidity in the COMP/WETH 0.3% pool?"* — rehearse it first
and confirm `toolCalls` is non-empty.

## Scene 7 — on-chain · 2:40–2:55

**Screen:** the Sepolia Etherscan **Read Contract** tab for `CapSteward`
(`0x7Ec8Ee63f9eE8C9Fc1F6aC126575adf0E3e6431E`). Paste WBTC's address into
`maxBorrowableUsd`.

> "And the number doesn't have to stay in a dashboard. This is a verified contract
> on Sepolia reading a published depth snapshot. Twenty-eight point eight million
> sellable becomes an eight-point-six-four million dollar borrow cap. Let the
> snapshot go fifteen minutes stale and it returns zero. No fresh depth, no new
> borrows."

## Scene 8 — close · 2:55–3:05

**Screen:** footnote, then the roadmap strip.

> "Uniswap v3 only, Ethereum mainnet, exposure is an upper bound — all of that is
> written on the page. The cap contract is Sepolia only and unaudited, and it says
> so. What runs today is the measurement. shoalfi.xyz."

---

## Live numbers (block 25963732)

| | |
| --- | --- |
| Tokens scored | **134** (Compound v3: 21, Morpho Blue: 126) |
| Over the safe cap (red) | **14** |
| No Uniswap venue | **103** |
| Markets indexed | 36 Compound v3 + 214 Morpho Blue |

**Rows to speak to**

| Token | Sellable | Safe cap | Lent | Ratio |
| --- | --- | --- | --- | --- |
| WBTC ✅ *use this one* | $28.8M | $8.64M | $412M | 47.68 |
| wstETH | $4.25M | $1.28M | $267M | 209.13 |
| PAXG | $3.52M | $1.06M | $56.8M | 53.81 |
| USDC (green contrast) | $45.8M | $13.7M | $299K | 0.02 |
| sUSDe ⚠️ | $1,167 | $350 | $1.7M | 4841 |
| COMP ⚠️ | $4,226 | $1,268 | $1.9M | 1503 |

**Unknown group:** sFRAX $32.3M · sdeUSD $29.3M · tETH $3.7M ·
**PT-reUSD-10DEC2026 $926K** · 22 PT tokens total, all `no_venue`.

## Questions you will get, and honest answers

**"Why is wstETH shallow?"** The threshold is $5M and we measured $4.25M. We only
walk the top 5 pools with a tick page cap, so we're conservative on depth. Real
depth is higher; the gap direction is known and documented.

**"Is 47× really right for WBTC?"** Exposure is `deposits × maxLTV` — an upper
bound assuming every depositor borrows the max. Real borrows are lower. It's a
risk ceiling, not a prediction.

**"Why is so much unknown?"** Morpho Blue lists a long tail of PT tokens, LRTs and
yield-bearing stables whose liquidity lives on Pendle, Curve or Balancer. We index
Uniswap v3 only, so we say unknown instead of guessing.

**"Is the contract live?"** Sepolia, verified, unaudited, and no lending market
consumes it. The oracle is a single-keeper feed with no signatures, no median and
no dispute window — that's in the contract's natspec.

## If it breaks mid-record

`/incident` needs no API at all — cut there and finish on the three cards. Or fall
back to terminal:

```sh
curl -si ".../tokens?limit=1" | grep x-shoalfi     # block header, proves freshness
curl -X POST .../ask -d '{"question":"..."}'        # model answering live
cast call 0x7Ec8… 'maxBorrowableUsd(address)(uint256)' 0x2260…  # on-chain cap
```

## Submission URLs

| | |
| --- | --- |
| Repo | <https://github.com/shoalfi/monorepo> |
| Dashboard | <https://app.shoalfi.xyz> |
| Incidents | <https://app.shoalfi.xyz/incident> |
| Landing | <https://shoalfi.xyz> |
| API health | <https://shoalfiserver-production.up.railway.app/health> |
| CapSteward (Sepolia) | <https://sepolia.etherscan.io/address/0x7Ec8Ee63f9eE8C9Fc1F6aC126575adf0E3e6431E> |
| DepthOracle (Sepolia) | <https://sepolia.etherscan.io/address/0x4655a18d3b3cF9644B90f633dbA030EAB12FF167> |
