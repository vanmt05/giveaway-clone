import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../state/eventStore'
import { canDraw, drawGroup, replaceWinner } from '../lib/event'
import type { Winner } from '../lib/types'

export default function ResultStep({ groupId }: { groupId: string }): React.JSX.Element | null {
  const { t, i18n } = useTranslation()
  const { event, update, go } = useStore()
  const [replacing, setReplacing] = useState<Winner | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const group = event?.groups.find((g) => g.id === groupId)
  const r = group?.result
  if (!event || !group || !r) return null
  const next = event.groups.find((g) => g.id !== groupId && !g.result && canDraw(g))

  const doReplace = (): void => {
    if (!replacing) return
    try {
      update((e) => replaceWinner(e, groupId, replacing.id, reason.trim()))
      setReplacing(null)
      setReason('')
      setError(null)
    } catch {
      setError(t('result.noEligible'))
    }
  }

  const redraw = (): void => {
    if (!window.confirm(t('result.drawAgain') + '?')) return
    update((e) => drawGroup(e, groupId))
    go({ name: 'animate', groupId })
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h1>
        {group.name} <span className="pill ok">{t('event.drawnBadge')}</span>
      </h1>
      <p className="muted">
        {t('result.drawnAt')}: {new Date(r.drawnAt).toLocaleString(i18n.language)} · {r.participants} {t('common.participants')} · {t('result.seed')}: <span className="mono">{r.seed.slice(0, 16)}…</span>
      </p>

      {r.shortfall.map((s, i) => (
        <div key={i} className="banner warn">
          {t('result.shortfall', {
            missing: s.missing,
            role: s.role === 'winner' ? t('result.roleWinner') : t('result.roleAlternate'),
            where: s.subgroup ? t('result.inSubgroup', { s: s.subgroup }) : ''
          })}
        </div>
      ))}

      <h2>{t('result.winners')}</h2>
      {r.winners.map((w) => (
        <div className="winner-card" key={`${w.id}-${w.position}`}>
          <span className="pos">{w.position}</span>
          <div className="grow">
            <div className="nm">{w.name}</div>
            <div className="muted">
              <span className="mono">{w.id}</span> · {w.subgroup}
              {w.prize && <> · 🏆 {w.prize}</>}
            </div>
          </div>
          <button className="btn small" onClick={() => (setReplacing(w), setReason(''), setError(null))}>
            {t('result.replace')}
          </button>
        </div>
      ))}

      {r.alternates.length > 0 && (
        <>
          <h2>{t('result.alternates')}</h2>
          {r.alternates.map((a, i) => (
            <div className="winner-card" key={`${a.id}-${i}`}>
              <span className="pos">{i + 1}</span>
              <div className="grow">
                <div className="nm">{a.name}</div>
                <div className="muted">
                  <span className="mono">{a.id}</span> · {a.subgroup}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {r.replacements.length > 0 && (
        <>
          <h3>{t('result.replacements')}</h3>
          <ul>
            {r.replacements.map((x, i) => (
              <li key={i}>
                {t('result.replacedBy', { out: `${x.out.name} (${x.out.id})`, in: `${x.in.name} (${x.in.id})` })}
                {x.reason && <span className="muted"> — {x.reason}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => go({ name: 'event' })}>
          {t('result.backToEvent')}
        </button>
        <button className="btn" onClick={redraw}>
          {t('result.drawAgain')}
        </button>
        {next && (
          <button className="btn" onClick={() => go({ name: 'review', groupId: next.id })}>
            {t('result.nextGroup')}: {next.name}
          </button>
        )}
        <span className="grow" />
        <button className="btn primary" onClick={() => go({ name: 'summary' })}>
          {t('result.summary')}
        </button>
      </div>

      {replacing && (
        <div className="modal-back" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>{t('result.replaceTitle', { name: replacing.name })}</h2>
            <div className="field">
              <label htmlFor="reason">{t('result.replaceReason')}</label>
              <input id="reason" className="input" type="text" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {error && <div className="banner err">{error}</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setReplacing(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn primary" onClick={doReplace}>
                {t('result.replaceConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
