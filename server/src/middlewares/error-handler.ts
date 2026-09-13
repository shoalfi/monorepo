import type { NextFunction, Request, Response } from "express"
import { log, errorMessage } from "../log"

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  log.error(`unhandled route error: ${errorMessage(err)}`)
  res.status(500).json({ error: "internal error" })
}
