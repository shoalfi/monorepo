import Image from "next/image"

import { Reveal } from "@/components/landing/reveal"
import { Band, Headline, Kicker } from "@/components/landing/ui"
import { cn } from "@/lib/utils"

const parts = [
  {
    title: "depth oracle",
    body: "how much usd you could sell right now within a 10% move, from uniswap v3 pool ticks via the graph.",
  },
  {
    title: "cap steward",
    roadmap: true,
    body: "roadmap: an on-chain cap that turns a signed depth snapshot into a max borrowable amount. compiled and tested, not deployed.",
  },
  {
    title: "scanner",
    body: "every collateral market we can index, ranked by how much is lent vs how much could actually be sold.",
  },
  {
    title: "ask in plain english",
    body: "a natural-language interface over the live data via the graph's subgraph mcp.",
  },
]

export function HowItWorks() {
  return (
    <Band id="how-it-works">
      <div className="border-b border-border px-4 py-12 md:px-10 md:py-16">
        <Reveal>
          <Kicker>how it works</Kicker>
          <Headline className="mt-3 text-[clamp(1.75rem,3.5vw,2.75rem)]">two numbers, one plug-in.</Headline>
        </Reveal>
      </div>
      <ol className="grid md:grid-cols-2">
        {parts.map((part, index) => (
          <li
            key={part.title}
            className={cn(
              "border-b border-border px-4 py-8 md:px-8 md:py-10",
              index % 2 === 1 && "md:border-l",
              index >= parts.length - 2 && "md:border-b-0",
              index === parts.length - 1 && "border-b-0",
            )}
          >
            <Reveal delay={index * 0.06}>
              <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
              <div className="mt-6 flex items-center gap-2">
                <h3 className="text-xl font-medium tracking-tight">{part.title}</h3>
                {"roadmap" in part && part.roadmap ? (
                  <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    roadmap
                  </span>
                ) : null}
              </div>
              <p className="mt-2 leading-relaxed text-muted-foreground">{part.body}</p>
            </Reveal>
          </li>
        ))}
      </ol>
      <div className="relative aspect-[2/1] border-t border-border">
        <Image
          draggable={false}
          src="/illustrations/how-it-works.png"
          alt="a depth reading from uniswap v3 pool ticks feeding a borrow cap, the scanner, and a plain-english question"
          fill
          sizes="100vw"
          className="object-contain mix-blend-lighten"
        />
      </div>
    </Band>
  )
}
