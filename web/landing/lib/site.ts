export const siteName = "shoalfi"

export const scannerUrl =
  process.env.NEXT_PUBLIC_SCANNER_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://app.shoalfi.xyz")


export const githubUrl = "https://github.com/shoalfi/monorepo"
export const docsUrl = `${githubUrl}#readme`
