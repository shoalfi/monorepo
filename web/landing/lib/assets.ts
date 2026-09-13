import fs from "node:fs"
import path from "node:path"

function firstExisting(candidates: string[]) {
  for (const rel of candidates) {
    if (fs.existsSync(path.join(process.cwd(), "public", rel))) return `/${rel}`
  }
  return undefined
}

export function getAssets() {
  return {
    demoVideo:
      process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ??
      firstExisting(["videos/demo.mp4", "videos/demo.webm"]) ??
      "https://youtu.be/th3Qm4krXaY",
  }
}

export type Assets = ReturnType<typeof getAssets>
