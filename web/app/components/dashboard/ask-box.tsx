"use client"

import { CornerDownLeft } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Markdown } from "@/components/dashboard/markdown"
import { postAsk } from "@/lib/api"
import { prettySource } from "@/lib/format"
import type { AskResponse, Token } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

const PRESETS = [
  "which markets are over-lent right now?",
  "what is the attack cost on the worst market?",
  "which collateral has no uniswap depth?",
]

const TIMEOUT_MS = 30_000
const COUNTDOWN_AFTER_MS = 10_000
const REVEAL_STEP_MS = 120

export function AskBox({ tokens, onToken }: { tokens: Token[]; onToken: (address: string) => void }) {
  const [question, setQuestion] = useState("")
  const [pending, setPending] = useState(false)
  const [response, setResponse] = useState<AskResponse | null>(null)
  const [revealed, setRevealed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const handles = timers.current
    return () => {
      for (const handle of handles) clearTimeout(handle)
    }
  }, [])

  useEffect(() => {
    if (!pending) return
    const started = Date.now()
    const interval = setInterval(() => setElapsed(Date.now() - started), 200)
    return () => clearInterval(interval)
  }, [pending])

  const submit = useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (!trimmed || pending) return
      setPending(true)
      setError(null)
      setResponse(null)
      setRevealed(0)
      setElapsed(0)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
      try {
        const result = await postAsk(trimmed, controller.signal)
        setResponse(result)
        result.toolCalls.forEach((_, index) => {
          timers.current.push(setTimeout(() => setRevealed(index + 1), index * REVEAL_STEP_MS))
        })
      } catch (cause: unknown) {
        void cause
        setError("couldn't reach the model, table below is still live")
      } finally {
        clearTimeout(timeout)
        setPending(false)
      }
    },
    [pending],
  )

  const remaining = Math.max(0, Math.ceil((TIMEOUT_MS - elapsed) / 1000))
  const showCountdown = pending && elapsed >= COUNTDOWN_AFTER_MS

  return (
    <section className="border-x border-t border-border px-4 py-5">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit(question)
        }}
        className="flex items-center gap-2"
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={pending}
          aria-label="ask about live markets"
          placeholder="ask about live markets. e.g. which tokens have more lent against them than could be sold?"
          className="h-10 flex-1 border border-input bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || question.trim() === ""}
          className="inline-flex h-10 items-center gap-2 border border-input px-3 text-sm transition-colors duration-100 hover:bg-accent disabled:opacity-50"
        >
          {pending ? <Spinner className="size-4" /> : <CornerDownLeft className="size-4" />}
          ask
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={pending}
            onClick={() => {
              setQuestion(preset)
              void submit(preset)
            }}
            className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground disabled:opacity-50"
          >
            {preset}
          </button>
        ))}
      </div>

      {pending ? (
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          thinking…{showCountdown ? ` timing out in ${remaining}s` : ""}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive-foreground">
          {error}
        </p>
      ) : null}

      {response ? (
        <div className="mt-4">
          <ul className="space-y-1">
            {response.toolCalls.slice(0, revealed).map((call, index) => (
              <li key={`${call.tool}-${call.target}-${index}`} className="font-mono text-xs text-muted-foreground">
                querying {prettySource(call.target)} {call.tool === "subgraph_query" ? "subgraph" : call.tool}…{" "}
                {call.ms === null ? "" : `${call.ms}ms`}
              </li>
            ))}
          </ul>

          {revealed >= response.toolCalls.length ? (
            <>
              <span
                className={cn(
                  "mt-3 inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs",
                  response.usedMcp
                    ? "border-success/40 text-success-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {response.usedMcp ? "answered via the graph subgraph mcp" : "answered from cached table"}
              </span>
              <div className="mt-3 max-w-3xl">
                <Markdown source={response.answer} tokens={tokens} onToken={onToken} />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
