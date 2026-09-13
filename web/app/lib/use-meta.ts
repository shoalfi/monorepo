"use client"

import { useEffect, useState } from "react"

import { getMeta } from "@/lib/api"
import type { Meta } from "@/lib/types"

export function useMeta(): { meta: Meta | null; failed: boolean } {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    getMeta()
      .then((value) => {
        if (active) setMeta(value)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [])

  return { meta, failed }
}
