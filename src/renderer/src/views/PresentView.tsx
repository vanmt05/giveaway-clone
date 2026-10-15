import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EventDoc, Winner } from '../lib/types'
import { fireConfetti } from '../steps/AnimationStep'
import FullscreenButton from '../components/FullscreenButton'

export default function PresentView(): React.JSX.Element {
  const { t } = useTranslation()
  const [event, setEvent] = useState<EventDoc | null>(null)
  const [i, setI] = useState(0)

  useEffect(() => {
    void window.api.present.get().then((d) => setEvent(d as EventDoc | null))
  }, [])

  const groups = event?.groups.filter((g) => g.result) ?? []
  const last = groups.length // slide 0 = title, 1..n = groups

  const go = useCallback((d: number) => setI((x) => Math.min(last, Math.max(0, x + d))), [last])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.close()
      else if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) go(1)
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  useEffect(() => {
    if (i > 0) fireConfetti()
  }, [i])

  if (!event) return <div className="present">{t('present.loading')}</div>
  const color = event.branding.color

  if (i === 0) {
    return (
      <div className="present" tabIndex={0}>
      <div className="fs-btn"><FullscreenButton /></div>
        {event.branding.logoDataUrl && <img src={event.branding.logoDataUrl} alt="" style={{ maxHeight: 90, background: '#fff', borderRadius: 12, padding: 10, marginBottom: 20 }} />}
        <h1 style={{ borderBottom: `6px solid ${color}`, paddingBottom: 8 }}>{event.title}</h1>
        <h2>{t('present.title')}</h2>
        <div className="foot">{t('present.hint')}</div>
      </div>
    )
  }

  const g = groups[i - 1]
  const r = g.result!
  const bySub = r.settingsUsed.quotaMode
  const sections: { title?: string; items: Winner[] }[] = bySub
    ? [...new Set(r.winners.map((w) => w.subgroup))].map((s) => ({ title: s, items: r.winners.filter((w) => w.subgroup === s) }))
    : [{ items: r.winners }]

  return (
    <div className="present" tabIndex={0}>
      <div className="fs-btn"><FullscreenButton /></div>
      <h1 style={{ borderBottom: `6px solid ${color}`, paddingBottom: 8 }}>{g.name}</h1>
      {sections.map((s, k) => (
        <div key={k} style={{ marginBottom: 14 }}>
          {s.title && <h2>{s.title}</h2>}
          {s.items.map((w) => (
            <div key={`${w.id}-${w.position}`} className="pw">
              {w.position}. {w.name}
              <span className="ps">
                {!bySub && w.subgroup}
                {w.prize ? ` · 🏆 ${w.prize}` : ''}
              </span>
            </div>
          ))}
        </div>
      ))}
      {r.alternates.length > 0 && (
        <>
          <h2>{t('result.alternates')}</h2>
          {r.alternates.map((a, k) => (
            <div key={`${a.id}-${k}`} style={{ fontSize: 24 }}>
              {k + 1}. {a.name} <span className="ps">{a.subgroup}</span>
            </div>
          ))}
        </>
      )}
      <div className="foot">
        {i}/{last} · {t('present.hint')}
      </div>
    </div>
  )
}
