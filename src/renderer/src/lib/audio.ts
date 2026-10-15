/** Synthesized sounds (no audio assets are shipped). */
let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function beep(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
  const c = ac()
  if (!c) return
  const t = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export const tick = (): void => beep(880, 0.05, 'square', 0.04)
export const countdownBeep = (): void => beep(660, 0.12, 'sine', 0.12)
export function fanfare(): void {
  ;[523, 659, 784, 1046].forEach((f, i) => beep(f, 0.35, 'triangle', 0.15, i * 0.12))
}
