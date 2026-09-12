import Image from "next/image"

import { docsUrl, githubUrl, scannerUrl } from "@/lib/site"

const links = [
  { label: "github", href: githubUrl, external: true },
  { label: "docs", href: docsUrl, external: true },
  { label: "scanner", href: scannerUrl },
]

export function Footer() {
  return (
    <footer>
      <div className="container-x flex flex-col gap-6 border-x border-border px-4 py-8 text-sm md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex items-center gap-2">
          <Image draggable={false} src="/logo.png" alt="" width={20} height={20} />
          <span className="font-medium">shoalfi</span>
          <span className="text-muted-foreground">executable liquidity oracle</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
              className="hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-x flex flex-col gap-1 border-x border-border px-4 py-4 font-mono text-xs text-muted-foreground md:flex-row md:justify-between md:px-10">
          <span>© {new Date().getFullYear()} shoalfi</span>
        </div>
      </div>
    </footer>
  )
}
