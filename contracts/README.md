# shoalfi contracts

> **ROADMAP. Not deployed to any public network, not audited.**
> shoalfi ships as an off-chain API for ETHOnline 2026. This folder shows how the
> API's `sellable_depth_usd` becomes an on-chain borrow cap. Everything here
> compiles, is tested, and has been deployed and exercised on a local chain
> against real scanner numbers, but nothing runs on a public network and no
> lending market consumes it.

## What is here

| File | Purpose |
|---|---|
| `src/CapSteward.sol` | `IDepthOracle` interface plus `CapSteward`, which turns a depth snapshot into `maxBorrowableUsd(token)` |
| `src/DepthOracle.sol` | Minimal keeper-written `IDepthOracle`: where the refresh job's `sellable_depth_usd` lands on-chain |
| `test/CapSteward.t.sol` | Foundry tests with a mock oracle: fresh, boundary, stale, unpublished, constructor guards, fuzz |
| `test/DepthOracle.t.sol` | Oracle access control and batching, plus end-to-end tests through `CapSteward` using a live scanner number |
| `script/CapSteward.s.sol` | `DeployCapSteward` deploys both and can seed one snapshot; `PublishDepth` posts a later one |

```sh
bun contracts:build   # forge build --root contracts
bun contracts:test    # forge test  --root contracts
bun contracts:fmt     # forge fmt   --root contracts
```

## How a lending protocol would use it

1. A keeper reads `GET /tokens/:address` from the shoalfi API every few minutes and
   posts `(token, sellable_depth_usd, computed_at)` to an `IDepthOracle`
   implementation. Each post is signed by the keeper key; the oracle rejects
   unsigned or older-than-latest snapshots.
2. The protocol deploys `CapSteward(oracle, 3000, 15 minutes)`: lend against at
   most 30% of the depth that can be sold within a 10% price move, and treat any
   snapshot older than 15 minutes as missing.
3. Before approving a borrow that uses `token` as collateral, the protocol's risk
   module calls `capSteward.maxBorrowableUsd(token)` and rejects the borrow if the
   market's total borrows against `token` would exceed the returned value.
4. Because a stale or missing snapshot returns `0`, the cap fails closed: an
   oracle outage stops new borrows against that token rather than allowing
   unlimited ones.

The two incidents that motivated shoalfi would have hit this cap directly. On
Moonwell (MAMO, Base, Aug 27 2026) the collateral had a market cap of a few
million dollars and daily volume around a million, so a 30%-of-depth cap would
have been far below the $11M that was borrowed. On Morpho (PT-reUSD, Aug 25 2026)
the Pendle pool held about $9M of liquidity against $67.5M of collateral.

## Why it is only a roadmap item

- The oracle feed does not exist yet. Posting signed snapshots needs a keeper,
  a funded key, and an on-chain contract with replay protection.
- `sellable_depth_usd` today is Uniswap v3 only and treats pools as independent.
  A production cap should read every venue and account for shared liquidity.
- Governance: who sets `capBps` and `maxStaleness`, and how a protocol overrides
  the cap for a token, are protocol decisions that are out of scope here.

## Deployed and exercised locally

The pair was deployed to a local Anvil chain and fed WBTC's real sellable depth
from the live scanner at block 25963583 (`$28,836,418`):

```sh
anvil &

SEED_TOKEN=0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 \
SEED_DEPTH_USD=28836418000000000000000000 \
forge script script/CapSteward.s.sol:DeployCapSteward \
  --rpc-url http://127.0.0.1:8545 --broadcast --private-key $PK

cast call $STEWARD 'maxBorrowableUsd(address)(uint256)' $WBTC --rpc-url $RPC
# 8650925400000000000000000   -> $8,650,925.40, exactly 30% of the published depth

# 16 minutes later, past maxStaleness
cast call $STEWARD 'maxBorrowableUsd(address)(uint256)' $WBTC --rpc-url $RPC
# 0                            -> fails closed: no fresh depth, no new borrows
```

To put it on a public testnet, point `--rpc-url` at that network and use a funded
key. Nothing else changes.

## Trust model, stated plainly

`DepthOracle` is a single-keeper feed. There is no signature scheme, no
multi-reporter median and no dispute window, so a production deployment would
need all three. It exists so `CapSteward` can be run end to end against real
numbers instead of being described in prose.
