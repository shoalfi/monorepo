import { Reveal } from "@/components/landing/reveal"
import { Band, Headline, Kicker, Placeholder } from "@/components/landing/ui"

function isEmbed(url: string) {
  return /youtube\.com|youtu\.be|vimeo\.com/.test(url)
}

function toEmbedUrl(url: string) {
  const youtube = url.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/)
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return url
}

export function Demo({ src }: { src?: string }) {
  return (
    <Band id="demo">
      <div className="border-b border-border px-4 py-12 md:px-10 md:py-16">
        <Reveal>
          <Kicker>demo</Kicker>
          <Headline className="mt-3 text-[clamp(1.75rem,3.5vw,2.75rem)]">see what your collateral is actually worth.</Headline>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            a live scanner over compound v3 and morpho blue collateral, ranked by how much is lent vs how much could
            be sold on uniswap v3. plus the numbers from the august incidents.
          </p>
        </Reveal>
      </div>
      <div className="aspect-video">
        {src ? (
          isEmbed(src) ? (
            <iframe
              src={toEmbedUrl(src)}
              title="shoalfi demo"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video src={src} className="h-full w-full bg-black" controls playsInline preload="metadata" aria-label="shoalfi demo" />
          )
        ) : (
          <Placeholder file="public/videos/demo.mp4" note="Product video" className="h-full" />
        )}
      </div>
    </Band>
  )
}
