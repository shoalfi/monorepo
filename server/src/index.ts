import cron from "node-cron"
import { env } from "./config"
import { log, errorMessage } from "./log"
import { closeDb, initSchema } from "./db/client"
import { runRefresh } from "./jobs/refresh"
import { buildApp } from "./app"

try {
  await initSchema()
} catch (err) {
  log.error(errorMessage(err))
  process.exit(1)
}

const app = await buildApp()
const server = app.listen(env.PORT, "0.0.0.0", () => {
  log.info(`shoalfi api listening on :${env.PORT}`)
})

void runRefresh("boot")
const task = cron.schedule(env.REFRESH_CRON, () => {
  void runRefresh("cron")
})
log.info(`refresh scheduled: ${env.REFRESH_CRON}`)

async function shutdown(signal: string) {
  log.info(`${signal} received, shutting down`)
  try {
    await task.stop()
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
    closeDb()
  } finally {
    process.exit(0)
  }
}
process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))
