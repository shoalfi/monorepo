"use client"

import { Fragment, type ReactNode } from "react"

import type { TokenScore } from "@/lib/types"

/**
 * A deliberately small markdown renderer: bold, inline code, list items and
 * paragraphs. Enough for the answer shapes the backend returns, with no new
 * dependency and no dangerouslySetInnerHTML.
 */

/** Splits on **bold** and `code`, then linkifies any known token symbol. */
function renderInline(text: string, tokens: TokenScore[], onToken: (address: string) => void): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let key = 0
  let match: RegExpExecArray | null

  const pushPlain = (plain: string) => {
    nodes.push(...linkifySymbols(plain, tokens, onToken, () => key++))
  }

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) pushPlain(text.slice(last, match.index))
    const chunk = match[0]
    if (chunk.startsWith("**")) {
      nodes.push(
        <strong key={`b${key++}`} className="font-medium text-foreground">
          {linkifySymbols(chunk.slice(2, -2), tokens, onToken, () => key++)}
        </strong>,
      )
    } else {
      nodes.push(
        <code key={`c${key++}`} className="bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          {chunk.slice(1, -1)}
        </code>,
      )
    }
    last = match.index + chunk.length
  }
  if (last < text.length) pushPlain(text.slice(last))
  return nodes
}

/** Token symbols that exist in /tokens become buttons that open the drawer. */
function linkifySymbols(
  text: string,
  tokens: TokenScore[],
  onToken: (address: string) => void,
  nextKey: () => number,
): ReactNode[] {
  if (tokens.length === 0) return [text]
  // Longest symbols first so PT-TESTL-DEC2026 wins over any shorter prefix.
  const sorted = [...tokens].sort((a, b) => b.symbol.length - a.symbol.length)
  const escaped = sorted.map((token) => token.symbol.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&"))
  const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "g")
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const token = sorted.find((candidate) => candidate.symbol === match?.[1])
    if (token) {
      nodes.push(
        <button
          key={`t${nextKey()}`}
          type="button"
          onClick={() => onToken(token.tokenAddress)}
          className="underline decoration-dotted underline-offset-4 transition-colors duration-100 hover:decoration-solid"
        >
          {token.symbol}
        </button>,
      )
    } else {
      nodes.push(match[0])
    }
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Markdown({
  source,
  tokens,
  onToken,
}: {
  source: string
  tokens: TokenScore[]
  onToken: (address: string) => void
}) {
  const lines = source.split("\n")
  const blocks: ReactNode[] = []
  let list: string[] = []

  const flushList = (key: string) => {
    if (list.length === 0) return
    blocks.push(
      <ul key={key} className="my-2 space-y-1 pl-4">
        {list.map((item, index) => (
          <li key={index} className="list-disc text-sm leading-relaxed marker:text-muted-foreground">
            {renderInline(item, tokens, onToken)}
          </li>
        ))}
      </ul>,
    )
    list = []
  }

  lines.forEach((raw, index) => {
    const line = raw.trim()
    if (line.startsWith("- ") || line.startsWith("* ")) {
      list.push(line.slice(2))
      return
    }
    flushList(`l${index}`)
    if (line === "") return
    blocks.push(
      <p key={`p${index}`} className="my-2 text-sm leading-relaxed">
        {renderInline(line, tokens, onToken)}
      </p>,
    )
  })
  flushList("l-final")

  return <div className="text-foreground">{blocks.map((block, index) => <Fragment key={index}>{block}</Fragment>)}</div>
}
