import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'

export function newSeed(): string {
  return bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(32)))
}

/** Derive a child seed (used for reproducible replacement picks). */
export function deriveSeed(seedHex: string, label: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(`${seedHex}:${label}`)))
}

/** Deterministic CSPRNG stream: SHA-256(seed || counter) in counter mode. */
export class Rng {
  private seed: Uint8Array
  private counter = 0
  private buf = new Uint8Array(0)
  private pos = 0

  constructor(seedHex: string) {
    this.seed = hexToBytes(seedHex)
  }

  private refill(): void {
    const input = new Uint8Array(this.seed.length + 4)
    input.set(this.seed)
    new DataView(input.buffer).setUint32(this.seed.length, this.counter++, false)
    this.buf = sha256(input)
    this.pos = 0
  }

  nextU32(): number {
    if (this.pos + 4 > this.buf.length) this.refill()
    const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4).getUint32(0, false)
    this.pos += 4
    return v
  }

  /** Uniform integer in [0, max) using rejection sampling (no modulo bias). */
  int(max: number): number {
    if (!Number.isInteger(max) || max < 1 || max > 0x100000000) throw new RangeError('max out of range')
    const limit = Math.floor(0x100000000 / max) * max
    let v = this.nextU32()
    while (v >= limit) v = this.nextU32()
    return v % max
  }

  /** Fisher-Yates; returns a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const a = items.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
}
