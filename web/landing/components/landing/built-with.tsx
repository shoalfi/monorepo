import Image from "next/image"

import { Band } from "@/components/landing/ui"

const partners = [
  { name: "the graph", logo: "/partners/thegraph.svg", href: "https://thegraph.com" },
  { name: "uniswap", logo: "/partners/uniswap.svg", href: "https://uniswap.org" },
]

export function BuiltWith() {
  return (
    <Band className="grid grid-cols-2 md:grid-cols-[auto_repeat(2,1fr)]">
      <div className="col-span-2 flex items-center border-b border-border px-4 py-3 font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase md:col-span-1 md:border-r md:border-b-0 md:px-6">
        built with
      </div>
      {partners.map((partner, index) => (
        <a
          key={partner.name}
          href={partner.href}
          target="_blank"
          rel="noreferrer"
          className={
            "flex h-16 items-center justify-center gap-3 border-border text-muted-foreground transition-colors hover:text-foreground md:h-auto md:border-r md:border-b-0 md:last:border-r-0 " +
            (index % 2 === 0 ? "border-r border-b md:border-b-0" : "border-b md:border-b-0") +
            (index < 2 ? "" : " border-b-0")
          }
        >
          <Image
            draggable={false}
            src={partner.logo}
            alt={partner.name}
            width={22}
            height={22}
            className="h-5 w-auto opacity-90"
          />
          <span className="text-sm font-medium text-foreground">{partner.name}</span>
        </a>
      ))}
    </Band>
  )
}
