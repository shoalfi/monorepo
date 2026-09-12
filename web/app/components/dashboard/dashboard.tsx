"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import { AskBox } from "@/components/dashboard/ask-box"
import { Filters, applyFilters, protocolsOf, type RiskFilter } from "@/components/dashboard/filters"
import { Footnote } from "@/components/dashboard/footnote"
import { Roadmap } from "@/components/dashboard/roadmap"
import { EmptyState, ErrorBanner, LoadingState } from "@/components/dashboard/states"
import { TokenDrawer } from "@/components/dashboard/token-drawer"
import { TokenTable, type SortDir, type SortKey } from "@/components/dashboard/token-table"
import { getTokens } from "@/lib/api"
import type { TokenScore } from "@/lib/types"

export function Dashboard() {
  const router = useRouter()
  const params = useSearchParams()
  const demo = params.get("demo") === "1"
  const selected = params.get("token")

  const [tokens, setTokens] = useState<TokenScore[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [risk, setRisk] = useState<RiskFilter>("all")
  const [protocol, setProtocol] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("ratio")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  useEffect(() => {
    const controller = new AbortController()
    getTokens(controller.signal)
      .then((data) => {
        setTokens(data)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : "unknown error")
      })
    return () => controller.abort()
  }, [])

  const onSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
        return
      }
      setSortKey(key)
      // Names read best A→Z; every numeric column is most interesting at the top.
      setSortDir(key === "symbol" ? "asc" : "desc")
    },
    [sortKey],
  )

  const openToken = useCallback(
    (address: string) => {
      const next = new URLSearchParams(params.toString())
      next.set("token", address)
      router.push(`?${next.toString()}`, { scroll: false })
    },
    [params, router],
  )

  const onSelect = useCallback((token: TokenScore) => openToken(token.tokenAddress), [openToken])

  const closeDrawer = useCallback(() => {
    const next = new URLSearchParams(params.toString())
    next.delete("token")
    const query = next.toString()
    router.push(query ? `?${query}` : "/", { scroll: false })
  }, [params, router])

  const protocols = useMemo(() => (tokens ? protocolsOf(tokens) : []), [tokens])
  const visible = useMemo(
    () => (tokens ? applyFilters(tokens, { query, risk, protocol }) : []),
    [tokens, query, risk, protocol],
  )

  if (error) {
    return (
      <div className="px-4 py-6">
        <ErrorBanner message={error} />
      </div>
    )
  }

  return (
    <div>
      <AskBox tokens={tokens ?? []} onToken={openToken} />
      {demo ? null : (
        <Filters
          query={query}
          onQuery={setQuery}
          risk={risk}
          onRisk={setRisk}
          protocol={protocol}
          onProtocol={setProtocol}
          protocols={protocols}
          count={visible.length}
        />
      )}
      {tokens === null ? (
        <LoadingState />
      ) : visible.length === 0 ? (
        <EmptyState />
      ) : (
        <TokenTable
          tokens={visible}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          onSelect={onSelect}
          big={demo}
        />
      )}
      <Footnote />
      <Roadmap />
      {selected ? <TokenDrawer key={selected} address={selected} onClose={closeDrawer} /> : null}
    </div>
  )
}
