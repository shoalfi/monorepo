import { GeistPixelSquare } from "geist/font/pixel"
import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

const title = "shoalfi: executable liquidity oracle for lending markets"
const description =
  "oracle for how much of a token can actually be sold, and how much has been lent against it. finds the collateral behind the pump-and-borrow attack."

export const metadata: Metadata = {
  metadataBase: new URL("https://www.shoalfi.xyz"),
  title,
  description,
  openGraph: {
    title: "shoalfi",
    description,
    type: "website",
    url: "/",
    siteName: "shoalfi",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "shoalfi: executable liquidity oracle for lending markets" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "shoalfi",
    description,
    images: ["/og.png"],
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("dark antialiased", "font-sans", inter.variable, geistMono.variable, GeistPixelSquare.variable)}
      style={{ ["--font-pixel" as string]: "var(--font-geist-pixel-square)" }}
    >
      <body className="bg-background text-foreground selection:bg-primary selection:text-primary-foreground">{children}</body>
    </html>
  )
}
