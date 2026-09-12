"use client"

import Image from "next/image"
import Link from "next/link"

import { FixturePill } from "@/components/dashboard/pills"
import { explorerBlockUrl, usingFixtures } from "@/lib/api"
import { blockNumber, prettySource, utcTime } from "@/lib/format"
import type { Meta } from "@/lib/types"
import { useMeta } from "@/lib/use-meta"

function MetaPill({ meta, failed }: { meta: Meta | null; failed: boolean }) {
  // A failed /health is never hidden: a stale block number on camera is worse
  // than an obvious red pill.
  if (failed) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-destructive/50 bg-destructive/10 px-3 py-1 font-mono text-xs text-destructive-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
        data unavailable
      </span>
    )
  }
  if (!meta) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground" />
        connecting…
      </span>
    )
  }
  if (meta.refreshing || meta.block === null) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-warning/50 bg-warning/10 px-3 py-1 font-mono text-xs text-warning-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-warning" />
        refreshing, no scored tokens yet
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
      <span aria-hidden className="size-1.5 rounded-full bg-success" />
      live · block{" "}
      <a
        href={explorerBlockUrl(meta.block)}
        target="_blank"
        rel="noreferrer"
        className="text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid"
      >
        {blockNumber(meta.block)}
      </a>{" "}
      · refreshed {utcTime(meta.refreshedAt)}
    </span>
  )
}

export function Header() {
  const { meta, failed } = useMeta()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="container-x flex h-14 items-center justify-between gap-4 border-x border-border px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2" aria-label="shoalfi home">
            <Image draggable={false} src="/logo.png" alt="" width={22} height={22} priority />
            <span className="font-semibold tracking-tight">shoalfi</span>
          </Link>
          {usingFixtures ? <FixturePill /> : null}
        </div>

        <div className="flex items-center gap-3">
          <MetaPill meta={meta} failed={failed} />
          {meta && !failed ? (
            <span className="hidden font-mono text-xs text-muted-foreground lg:inline">
              {prettySource(meta.lendingSource)} schema
            </span>
          ) : null}
          <Link
            href="/incident"
            className="hidden font-mono text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground sm:block"
          >
            incidents
          </Link>
        </div>
      </div>
    </header>
  )
}
