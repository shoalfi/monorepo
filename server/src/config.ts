import { z } from "zod"
import { validate as validateCron } from "node-cron"

const clean = (value: unknown): unknown => {
  if (typeof value !== "string") return value
  const s = value.replace(/\s+#.*$/, "").trim()
  return s === "" ? undefined : s
}

const requiredString = () => z.preprocess(clean, z.string().min(1))
const optionalString = () => z.preprocess(clean, z.string().min(1).optional())
const numberWithDefault = (schema: z.ZodNumber, fallback: number) =>
  z.preprocess(clean, z.coerce.number().pipe(schema).default(fallback))

const EnvSchema = z
  .object({
    PORT: numberWithDefault(z.number().int().min(1).max(65535), 4000),

    GRAPH_API_KEY: requiredString(),
    ANTHROPIC_API_KEY: optionalString(),
    ANTHROPIC_MODEL: z.preprocess(clean, z.string().default("claude-opus-5")),
    SUBGRAPH_MCP_URL: z.preprocess(
      clean,
      z.url().default("https://subgraphs.mcp.thegraph.com/sse")
    ),

    DATABASE_PATH: z.preprocess(clean, z.string().min(1).default("./data/shoalfi.sqlite")),

    UNISWAP_V3_SUBGRAPH_ID: requiredString(),
    LENDING_SOURCE: z.preprocess(
      clean,
      z.enum(["messari", "aave"]).default("messari")
    ),
    MESSARI_AAVE_V3_SUBGRAPH_ID: optionalString(),
    MESSARI_COMPOUND_V3_SUBGRAPH_ID: optionalString(),
    MORPHO_BLUE_SUBGRAPH_ID: optionalString(),
    AAVE_V3_OFFICIAL_SUBGRAPH_ID: optionalString(),

    SLIPPAGE_BPS: numberWithDefault(z.number().int().min(1).max(9999), 1000),
    CAP_FRACTION: numberWithDefault(z.number().gt(0).lte(1), 0.3),
    PUMP_TARGET_BPS: numberWithDefault(z.number().int().min(1), 10_000),
    SHALLOW_DEPTH_USD: numberWithDefault(z.number().min(0), 5_000_000),
    MAX_POOLS_PER_TOKEN: numberWithDefault(z.number().int().min(1), 5),
    MAX_TICK_PAGES_PER_POOL: numberWithDefault(z.number().int().min(1), 5),
    MIN_MARKET_DEPOSIT_USD: numberWithDefault(z.number().min(0), 10_000),
    REFRESH_CRON: z.preprocess(
      clean,
      z
        .string()
        .default("*/5 * * * *")
        .refine((c) => validateCron(c), "REFRESH_CRON is not a valid cron expression")
    ),
  })
  .superRefine((e, ctx) => {
    if (
      e.LENDING_SOURCE === "messari" &&
      !e.MESSARI_AAVE_V3_SUBGRAPH_ID &&
      !e.MESSARI_COMPOUND_V3_SUBGRAPH_ID &&
      !e.MORPHO_BLUE_SUBGRAPH_ID
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["LENDING_SOURCE"],
        message:
          "LENDING_SOURCE=messari needs at least one of MESSARI_AAVE_V3_SUBGRAPH_ID, MESSARI_COMPOUND_V3_SUBGRAPH_ID, MORPHO_BLUE_SUBGRAPH_ID",
      })
    }
    if (e.LENDING_SOURCE === "aave" && !e.AAVE_V3_OFFICIAL_SUBGRAPH_ID) {
      ctx.addIssue({
        code: "custom",
        path: ["LENDING_SOURCE"],
        message: "LENDING_SOURCE=aave needs AAVE_V3_OFFICIAL_SUBGRAPH_ID",
      })
    }
  })

export type Env = z.infer<typeof EnvSchema>

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse(source)
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`
    )
    throw new Error(`Invalid environment:\n${lines.join("\n")}`)
  }
  return result.data
}

let cached: Env | undefined

export function getEnv(): Env {
  cached ??= parseEnv()
  return cached
}

export const env: Env = new Proxy({} as Env, {
  get: (_target, key) => getEnv()[key as keyof Env],
  has: (_target, key) => key in getEnv(),
  ownKeys: () => Reflect.ownKeys(getEnv()),
  getOwnPropertyDescriptor: (_target, key) =>
    Object.getOwnPropertyDescriptor(getEnv(), key),
})

export type SubgraphRef = { name: string; id: string; role: "uniswap" | "lending" }

export function configuredSubgraphs(e: Env = env): SubgraphRef[] {
  const refs: SubgraphRef[] = [
    { name: "uniswap-v3-ethereum", id: e.UNISWAP_V3_SUBGRAPH_ID, role: "uniswap" },
  ]
  if (e.LENDING_SOURCE === "messari") {
    if (e.MESSARI_AAVE_V3_SUBGRAPH_ID)
      refs.push({ name: "messari-aave-v3-ethereum", id: e.MESSARI_AAVE_V3_SUBGRAPH_ID, role: "lending" })
    if (e.MESSARI_COMPOUND_V3_SUBGRAPH_ID)
      refs.push({
        name: "messari-compound-v3-ethereum",
        id: e.MESSARI_COMPOUND_V3_SUBGRAPH_ID,
        role: "lending",
      })
    if (e.MORPHO_BLUE_SUBGRAPH_ID)
      refs.push({ name: "morpho-blue-ethereum", id: e.MORPHO_BLUE_SUBGRAPH_ID, role: "lending" })
  } else if (e.AAVE_V3_OFFICIAL_SUBGRAPH_ID) {
    refs.push({ name: "aave-v3-ethereum", id: e.AAVE_V3_OFFICIAL_SUBGRAPH_ID, role: "lending" })
  }
  return refs
}
