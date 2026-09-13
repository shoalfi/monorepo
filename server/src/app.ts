import express, { type Express } from "express"
import cors from "cors"
import { errorHandler } from "./middlewares/error-handler"
import { healthRouter } from "./routes/health.routes"
import { tokensRouter } from "./routes/tokens.routes"
import { askRouter } from "./routes/ask.routes"
import { metaRouter } from "./routes/meta.routes"

export async function buildApp(): Promise<Express> {
  const app = express()
  app.use(
    cors({
      origin: true,
      exposedHeaders: ["x-shoalfi-block", "x-shoalfi-refreshed-at"],
    })
  )
  app.use(express.json())

  app.use(healthRouter)
  app.use(tokensRouter)
  app.use(askRouter)
  app.use(metaRouter)

  app.use(errorHandler)

  return app
}
