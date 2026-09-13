import type { Request, Response } from "express"
import { configuredSubgraphs, env } from "../config"
import { lastRun } from "../db/repo"

export async function getMeta(_req: Request, res: Response): Promise<void> {
  const run = await lastRun().catch(() => null)
  const subgraphs = configuredSubgraphs()
  res.json({
    chain: "ethereum",
    block: run?.uniswapBlock ?? null,
    refreshedAt: run?.finishedAt ?? null,
    sources: {
      lending: subgraphs.filter((s) => s.role === "lending").map((s) => s.name),
      dex: subgraphs.filter((s) => s.role === "uniswap").map(() => "uniswap-v3"),
    },
    lendingSchema: env.LENDING_SOURCE === "aave" ? "aave-official" : "messari-standardized",
    capFraction: env.CAP_FRACTION,
    pumpTargetPct: env.PUMP_TARGET_BPS / 10_000,
  })
}
