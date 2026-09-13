import Image from "next/image"

import { Reveal } from "@/components/landing/reveal"
import { Band, Button, Headline } from "@/components/landing/ui"
import { scannerUrl } from "@/lib/site"

export function Hero() {
  return (
    <Band id="top" className="grid lg:grid-cols-2">
      <div className="border-b border-border px-4 py-20 md:px-10 md:py-28 lg:border-r lg:border-b-0 lg:py-32">
        <Reveal>
          <Headline as="h1" className="max-w-3xl text-[clamp(1.75rem,3.5vw,3rem)]">
            know what your collateral is actually worth if you had to sell it.
          </Headline>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            shoalfi publishes how much of a token can really be sold, and ranks every market by how much has been lent against it.
          </p>
        </Reveal>
        <Reveal delay={0.14}>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button href={scannerUrl} className="h-11 px-5">
              open scanner
            </Button>
            <Button href="#demo" variant="outline" className="h-11 px-5">
              watch the demo
            </Button>
          </div>
        </Reveal>
      </div>
      <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[440px]">
        <Image
          draggable={false}
          src="/illustrations/hero-shoal.png"
          alt="a robot on a jetty lowering a sounding line to measure how much of a token is sellable before a lending market will lend against it"
          fill
          sizes="(min-width: 1024px) 640px, 100vw"
          className="object-contain mix-blend-lighten"
          priority
        />
      </div>
    </Band>
  )
}
