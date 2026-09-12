import Image from "next/image"

import { Reveal } from "@/components/landing/reveal"
import { Band, Headline, Kicker } from "@/components/landing/ui"

const incidents = [
  {
    name: "tectonic",
    icon: "/protocols/tectonic.svg",
    date: "aug 30",
    figure: "~$75m",
    body: "TONIC pumped ~100x in 20 minutes, borrowed against it. cronos halted the chain.",
  },
  {
    name: "moonwell",
    icon: "/protocols/moonwell.png",
    date: "aug 27",
    figure: "$8.7m",
    body: "MAMO pumped ~8× across two thin pools, then used as collateral on base.",
  },
  {
    name: "morpho",
    icon: "/protocols/morpho.svg",
    date: "aug 25",
    figure: "$36.4m liquidated",
    body: "a $320k trade in a thin pendle pool moved PT-reUSD 3%. $67.5m of collateral sat behind a $9m pool.",
  },
]

export function Problem() {
  return (
    <Band id="problem">
      <div className="grid lg:grid-cols-2">
        <div className="border-b border-border px-4 py-12 md:px-10 md:py-16 lg:border-r lg:border-b-0">
          <Reveal>
            <Kicker>last week of august 2026</Kicker>
            <Headline className="mt-3 text-[clamp(1.75rem,3.5vw,2.75rem)]">
              three protocols, one week, same attack.
            </Headline>
            <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
              pump a token nobody trades. post it as collateral at the inflated price. borrow real assets. leave. the
              protocol never asked how much of that token could actually be sold.
            </p>
          </Reveal>
        </div>
        <div className="relative aspect-[16/10] border-b border-border lg:border-b-0">
          <Image
            draggable={false}
            src="/illustrations/hero-attack.png"
            alt="a token price pumped on a thin pool, posted as collateral, and borrowed against before anyone checks how much of it could be sold"
            fill
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-contain mix-blend-lighten"
          />
        </div>
      </div>
      <ul className="grid border-t border-border md:grid-cols-3">
        {incidents.map((incident, index) => (
          <li
            key={incident.name}
            className="border-b border-border px-4 py-8 last:border-b-0 md:border-r md:border-b-0 md:px-8 md:py-10 md:last:border-r-0"
          >
            <Reveal delay={index * 0.06}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Image
                    draggable={false}
                    src={incident.icon}
                    alt=""
                    width={20}
                    height={20}
                    className="h-5 w-auto opacity-90"
                  />
                  <h3 className="text-xl font-medium tracking-tight">{incident.name}</h3>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{incident.date}</span>
              </div>
              <p className="mt-4 font-mono text-sm">{incident.figure}</p>
              <p className="mt-2 leading-relaxed text-muted-foreground">{incident.body}</p>
            </Reveal>
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-4 py-4 text-xs text-muted-foreground italic md:px-10">
        aave pays risk firms to watch for it. the other couple hundred lending markets have nothing.
      </p>
    </Band>
  )
}
