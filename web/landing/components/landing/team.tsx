import Image from "next/image"

import { Reveal } from "@/components/landing/reveal"
import { Band, Headline, Kicker } from "@/components/landing/ui"

const team = [
  { handle: "vwakesahu", role: "backend + engine", avatar: "/team/vwakesahu.png" },
  { handle: "shubhamtwtt", role: "contracts", avatar: "/team/shubhamtwtt.png" },
  { handle: "0xweshall", role: "frontend", avatar: "/team/0xweshall.png" },
]

export function Team() {
  return (
    <Band id="team">
      <div className="border-b border-border px-4 py-12 md:px-10 md:py-16">
        <Reveal>
          <Kicker>team</Kicker>
          <Headline className="mt-3 text-[clamp(1.75rem,3.5vw,2.75rem)]">built at ethonline 2026</Headline>
        </Reveal>
      </div>
      <ul className="grid md:grid-cols-3">
        {team.map((member, index) => (
          <li
            key={member.handle}
            className="border-b border-border last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0"
          >
            <Reveal delay={index * 0.06}>
              <a
                href={`https://x.com/${member.handle}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-4 px-4 py-6 transition-colors hover:bg-accent md:px-8"
              >
                <Image
                  draggable={false}
                  src={member.avatar}
                  alt=""
                  width={48}
                  height={48}
                  className="size-12 shrink-0 rounded-full grayscale"
                />
                <div className="min-w-0">
                  <p className="truncate text-base font-medium tracking-tight">{member.role}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">@{member.handle}</p>
                </div>
              </a>
            </Reveal>
          </li>
        ))}
      </ul>
    </Band>
  )
}
