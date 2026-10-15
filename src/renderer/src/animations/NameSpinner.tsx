import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { tick, fanfare } from '../lib/audio'
import { MAX_SEQUENTIAL, type AnimProps } from './types'

export default function NameSpinner({ winners, candidates, durationSec, sound, brandColor, onDone }: AnimProps): React.JSX.Element {
  const { t } = useTranslation()
  const [shown, setShown] = useState<{ name: string; subgroup: string } | null>(null)
  const [locked, setLocked] = useState(false)
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState<typeof winners>([])

  const sequential = winners.length <= MAX_SEQUENTIAL
  const steps = sequential ? winners : [null]

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const per = Math.max(2, durationSec / steps.length) * 1000
    const pool = candidates.length ? candidates : winners
    const target = steps[idx]
    const start = performance.now()
    setLocked(false)

    const step = (): void => {
      if (cancelled) return
      const t = performance.now() - start
      if (t >= per) {
        if (target) {
          setShown({ name: target.name, subgroup: target.subgroup })
          setDone((d) => [...d, target])
        }
        setLocked(true)
        if (sound) fanfare()
        timer = setTimeout(() => {
          if (cancelled) return
          if (idx + 1 < steps.length) setIdx(idx + 1)
          else onDone()
        }, 1300)
        return
      }
      const p = t / per
      setShown(pool[Math.floor(Math.random() * pool.length)])
      if (sound) tick()
      timer = setTimeout(step, 40 + 360 * p * p)
    }
    step()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  return (
    <div className="stage" aria-live="polite">
      {sequential && <div className="sub">{t('animate.winnerN', { n: idx + 1 })}</div>}
      <div className="big-name" style={{ color: locked ? brandColor : undefined, opacity: locked ? 1 : 0.7 }}>
        {shown?.name ?? '…'}
      </div>
      <div className="sub">{shown?.subgroup ?? ''}</div>
      {done.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {done.map((w) => (
            <div key={`${w.id}-${w.position}`} className="muted">
              {w.position}. {w.name} — {w.subgroup}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
