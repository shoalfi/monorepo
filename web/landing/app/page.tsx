import { BuiltWith } from "@/components/landing/built-with"
import { Demo } from "@/components/landing/demo"
import { Faq, type FaqItem } from "@/components/landing/faq"
import { Footer } from "@/components/landing/footer"
import { Hero } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Limits } from "@/components/landing/limits"
import { Nav } from "@/components/landing/nav"
import { Problem } from "@/components/landing/problem"
import { Team } from "@/components/landing/team"
import { Band, Headline, Kicker } from "@/components/landing/ui"
import { getAssets } from "@/lib/assets"

const faqs: FaqItem[] = [
  {
    question: "is this a replacement for my price oracle?",
    answer:
      "no. a price feed tells you what one token trades at. shoalfi tells you how much of it you could actually sell.",
  },
  {
    question: "what does a lending market have to do to use it?",
    answer:
      "nothing today. shoalfi is a read-only scanner you can point at a market. the on-chain cap that would clamp borrowing to the safe number is roadmap, not deployed.",
  },
  {
    question: "where do the numbers come from?",
    answer:
      "uniswap v3 pool ticks via the graph, against compound v3 and morpho blue collateral markets on ethereum mainnet.",
  },
]

export default function Page() {
  const assets = getAssets()

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Problem />
        <HowItWorks />
        <Demo src={assets.demoVideo} />
        <Limits />
        <BuiltWith />
        <Team />
        <Band id="faq">
          <div className="border-b border-border px-4 py-12 md:px-10 md:py-16">
            <Kicker>FAQ</Kicker>
            <Headline className="mt-3 text-[clamp(1.75rem,3.5vw,2.75rem)]">questions, answered.</Headline>
          </div>
          <Faq items={faqs} />
        </Band>
      </main>
      <Footer />
    </>
  )
}
