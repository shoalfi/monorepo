import { Reveal } from "@/components/landing/reveal"
import { Band, Headline, Kicker } from "@/components/landing/ui"

export function Limits() {
  return (
    <Band id="limits" className="px-4 py-20 md:px-10 md:py-28">
      <Reveal>
        <Kicker>honest limits</Kicker>
        <Headline className="mt-3 max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)]">what it doesn&rsquo;t do.</Headline>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          it won&rsquo;t save a market from a flash crash or from bad debt caused by honest volatility. it measures one thing, the gap that
          keeps getting exploited, for everyone gauntlet and chaos labs don&rsquo;t cover.
        </p>
      </Reveal>
    </Band>
  )
}
