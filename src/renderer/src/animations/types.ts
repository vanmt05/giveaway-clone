import type { Winner } from '../lib/types'

export type AnimProps = {
  /** winners already decided (the animation only reveals them) */
  winners: Winner[]
  /** names used for the visual shuffle */
  candidates: { name: string; subgroup: string }[]
  durationSec: number
  sound: boolean
  brandColor: string
  onDone: () => void
}

/** More winners than this are revealed in a single pass instead of one by one. */
export const MAX_SEQUENTIAL = 5

export function sample<T>(items: T[], n: number): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}
