# shoalfi landing

Landing frontend for shoalfi, built with Next.js, Tailwind and the coss/shadcn
theme tokens. Run `bun dev:landing` from the repository root to serve it on
port 3001.

## Structure

- `app/page.tsx` assembles the sections and holds the FAQ copy.
- `components/landing/*` holds one file per section. `ui.tsx` has the shared
  primitives (bands, headline, kicker, button, placeholder).
- `lib/site.ts` holds links; `lib/assets.ts` resolves the demo video at build
  time.
- `public/` holds the mark, partner logos and illustrations. Drop
  `public/videos/demo.mp4` in to replace the demo placeholder.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SCANNER_URL` | Target of the “open scanner” buttons. Defaults to `http://localhost:3000` in development and `https://app.shoalfi.xyz` otherwise. |
| `NEXT_PUBLIC_DEMO_VIDEO_URL` | Hosted product demo (YouTube, Vimeo or a direct file). Overrides `public/videos/demo.mp4`. |

## Adding components

```bash
bunx --bun shadcn@latest add @coss/button
```

```tsx
import { Button } from "@/components/ui/button";
```

## AI tools used

Built with Claude Code (Claude Opus 4.5): the section components in
`components/landing/`, `app/page.tsx`, `app/layout.tsx`, `lib/site.ts` and
`lib/assets.ts`, plus the pass that removed every claim the code did not back
(the cap steward is now labelled roadmap; the red-team page, the forked-market
replay, the x402 gateway and the Chainlink/CEX depth source were deleted).
