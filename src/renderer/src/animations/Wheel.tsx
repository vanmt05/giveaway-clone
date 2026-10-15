import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { tick, fanfare } from '../lib/audio'
import { MAX_SEQUENTIAL, sample, type AnimProps } from './types'

const SIZE = 480
const MAX_SEGMENTS = 20
const TAU = Math.PI * 2

function palette(base: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `hsl(${(i * 360) / n + 290}, 62%, ${i % 2 ? 58 : 46}%)`).map((c, i) => (i === 0 && base ? base : c))
}

export default function Wheel({ winners, candidates, durationSec, sound, brandColor, onDone }: AnimProps): React.JSX.Element {
  const { t } = useTranslation()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [idx, setIdx] = useState(0)
  const [label, setLabel] = useState('')

  const sequential = winners.length <= MAX_SEQUENTIAL
  const steps = sequential ? winners : [winners[0]]

  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let cancelled = false
    let raf = 0
    let timer: ReturnType<typeof setTimeout>

    const target = steps[idx]
    const others = sample(candidates.filter((x) => x.name !== target.name), MAX_SEGMENTS - 1)
    const segs = sample([{ name: target.name, subgroup: target.subgroup }, ...others], MAX_SEGMENTS)
    const n = segs.length
    const win = segs.findIndex((s) => s.name === target.name)
    const colors = palette('', n)
    const arc = TAU / n
    // pointer at top (-90deg); land on the middle of the winner's segment with a small jitter
    const jitter = (Math.random() - 0.5) * arc * 0.6
    const finalAngle = TAU * (5 + Math.floor(Math.random() * 3)) + (-Math.PI / 2 - (win * arc + arc / 2 + jitter))
    const dur = Math.max(2, durationSec / steps.length) * 1000
    const t0 = performance.now()
    let lastSeg = -1

    const draw = (rot: number): void => {
      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.save()
      ctx.translate(SIZE / 2, SIZE / 2)
      ctx.rotate(rot)
      segs.forEach((s, i) => {
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, SIZE / 2 - 8, i * arc, (i + 1) * arc)
        ctx.fillStyle = colors[i]
        ctx.fill()
        ctx.save()
        ctx.rotate(i * arc + arc / 2)
        ctx.fillStyle = '#fff'
        ctx.font = '600 15px Segoe UI, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(s.name.length > 20 ? s.name.slice(0, 19) + '…' : s.name, SIZE / 2 - 24, 5)
        ctx.restore()
      })
      ctx.restore()
      ctx.fillStyle = brandColor
      ctx.beginPath()
      ctx.moveTo(SIZE / 2 - 14, 2)
      ctx.lineTo(SIZE / 2 + 14, 2)
      ctx.lineTo(SIZE / 2, 38)
      ctx.closePath()
      ctx.fill()
    }

    const frame = (now: number): void => {
      if (cancelled) return
      const p = Math.min(1, (now - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      const rot = finalAngle * eased
      draw(rot)
      const seg = Math.floor((((-Math.PI / 2 - rot) % TAU) + TAU) % TAU / arc)
      if (seg !== lastSeg) {
        lastSeg = seg
        if (sound && p < 1) tick()
      }
      if (p < 1) raf = requestAnimationFrame(frame)
      else {
        setLabel(`${target.name} — ${target.subgroup}`)
        if (sound) fanfare()
        timer = setTimeout(() => {
          if (cancelled) return
          if (idx + 1 < steps.length) {
            setLabel('')
            setIdx(idx + 1)
          } else onDone()
        }, 1500)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  return (
    <div className="stage" aria-live="polite">
      {sequential && <div className="sub">{t('animate.winnerN', { n: idx + 1 })}</div>}
      <canvas ref={canvas} width={SIZE} height={SIZE} style={{ maxWidth: '80vmin', height: 'auto' }} aria-label={t('settings.wheel')} />
      <div className="big-name" style={{ fontSize: 34 }}>
        {label}
      </div>
    </div>
  )
}
