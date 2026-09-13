import type { Request, Response } from "express"
import { z } from "zod"
import { log, errorMessage } from "../log"
import { ask, fallbackResponse } from "../services/ask.service"

const AskBody = z.object({ question: z.string().trim().min(3).max(1000) })

export async function postAsk(req: Request, res: Response): Promise<void> {
  const parsed = AskBody.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", issues: parsed.error.issues })
    return
  }
  try {
    res.json(await ask(parsed.data.question))
  } catch (err) {
    const reason = errorMessage(err)
    log.error(`ask failed: ${reason}`)
    res.json(await fallbackResponse(reason))
  }
}
