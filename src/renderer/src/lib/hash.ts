import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import type { Entry } from './types'
import { normId, normSub } from './normalize'

export function sha256Hex(text: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(text)))
}

export function listHash(entries: readonly Entry[]): string {
  const lines = entries.map((e) => `${normId(e.id)}|${e.name}|${normSub(e.subgroup)}`).sort()
  return sha256Hex(lines.join('\n'))
}

export function excludedHash(ids: readonly string[]): string {
  return sha256Hex([...ids].sort().join('\n'))
}
