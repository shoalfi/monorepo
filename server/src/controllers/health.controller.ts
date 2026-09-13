import type { Request, Response } from "express"
import { configuredSubgraphs, env } from "../config"
import { pingDb } from "../db/client"
import { lastRun } from "../db/repo"

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const dbOk = await pingDb()
  const run = dbOk ? await lastRun().catch(() => null) : null
  res.status(dbOk ? 200 : 503).json({
    ok: dbOk,
    lastRun: run,
    lendingSource: env.LENDING_SOURCE,
    subgraphs: configuredSubgraphs().map(({ name, id }) => ({ name, id })),
    uptimeSec: Math.round(process.uptime()),
  })
}
