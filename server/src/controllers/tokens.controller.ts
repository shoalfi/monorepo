import type { Request, Response } from "express"
import { z } from "zod"
import { getScore, lastRun, listScores, SORT_KEYS, type LastRun } from "../db/repo"

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

const flag = z.preprocess(
  (v) => (v === undefined ? false : v === "1" || v === "true" || v === true),
  z.boolean()
)

export const ListQuery = z.object({
  sort: z.enum(SORT_KEYS).default("exposure_ratio"),
  order: z.enum(["asc", "desc"]).default("desc"),
  min_exposure_usd: z.coerce.number().min(0).default(0),
  protocol: z.enum(["aave-v3", "compound-v3", "morpho-blue"]).optional(),
  include_unknown: flag,
  limit: z.coerce.number().int().min(1).max(1000).default(200),
})

let stamp: { at: number; run: LastRun | null } | null = null
async function refreshStamp(): Promise<LastRun | null> {
  const now = Date.now()
  if (stamp && now - stamp.at < 5_000) return stamp.run
  const run = await lastRun().catch(() => null)
  stamp = { at: now, run }
  return run
}

async function stampReply(res: Response): Promise<void> {
  const run = await refreshStamp()
  if (run?.uniswapBlock) res.setHeader("x-shoalfi-block", String(run.uniswapBlock))
  if (run?.finishedAt) res.setHeader("x-shoalfi-refreshed-at", run.finishedAt)
}

export async function listTokens(req: Request, res: Response): Promise<void> {
  const parsed = ListQuery.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: "invalid query", issues: parsed.error.issues })
    return
  }
  const q = parsed.data
  const rows = await listScores({
    sort: q.sort,
    order: q.order,
    minExposureUsd: q.min_exposure_usd,
    protocol: q.protocol,
    includeUnknown: q.include_unknown,
    limit: q.limit,
  })
  await stampReply(res)
  res.json(rows)
}

export async function getToken(req: Request<{ address: string }>, res: Response): Promise<void> {
  const { address } = req.params
  if (!address || !ADDRESS_RE.test(address)) {
    res.status(400).json({ error: "invalid address" })
    return
  }
  const score = await getScore(address.toLowerCase())
  if (!score) {
    res.status(404).json({ error: "not found" })
    return
  }
  await stampReply(res)
  res.json(score)
}
