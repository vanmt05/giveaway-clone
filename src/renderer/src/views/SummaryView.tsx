import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../state/eventStore'
import { subgroupTotals } from '../lib/event'
import { csvRows, fileSafe, xlsxSheets } from '../lib/exports'
import { buildCertificateHtml } from '../lib/certificate'

export default function SummaryView(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { event, go } = useStore()
  const [msg, setMsg] = useState<string | null>(null)
  if (!event) return null
  const totals = subgroupTotals(event)
  const drawn = event.groups.filter((g) => g.result)
  const base = fileSafe(event.title)

  const run = async (p: Promise<string | null>): Promise<void> => {
    const path = await p
    setMsg(path ? t('summary.saved', { path }) : null)
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn" onClick={() => go({ name: 'event' })}>
          {t('common.back')}
        </button>
        <h1 style={{ margin: 0 }}>{t('summary.title')}</h1>
        <span className="grow" />
        <button className="btn" disabled={!drawn.length} onClick={() => void run(window.api.exportCsv(base, csvRows(event)))}>
          {t('summary.exportCsv')}
        </button>
        <button className="btn" disabled={!drawn.length} onClick={() => void run(window.api.exportXlsx(base, xlsxSheets(event)))}>
          {t('summary.exportXlsx')}
        </button>
        <button className="btn" disabled={!drawn.length} onClick={() => void run(window.api.exportPdf(base, buildCertificateHtml(event)))}>
          {t('summary.exportPdf')}
        </button>
        <button className="btn" disabled={!drawn.length} onClick={() => void run(window.api.exportPng(base, buildCertificateHtml(event)))}>
          {t('summary.exportPng')}
        </button>
        <button className="btn primary" disabled={!drawn.length} onClick={() => void window.api.present.open(event)}>
          ▶ {t('summary.present')}
        </button>
      </div>
      {msg && <div className="banner ok">{msg}</div>}
      {!drawn.length && <p className="muted">{t('summary.nothing')}</p>}

      <div className="cards">
        {event.groups.map((g) => {
          const r = g.result
          return (
            <div className="card" key={g.id} style={{ borderTop: `4px solid ${event.branding.color}` }}>
              <h2>{g.name}</h2>
              {!r ? (
                <p className="muted">{t('summary.notDrawn')}</p>
              ) : (
                <>
                  <p className="muted">
                    {r.participants} {t('summary.participants')}
                    {r.settingsUsed.subgroupFilter !== 'all' && <> · {t('summary.filter')}: {r.settingsUsed.subgroupFilter.join(', ')}</>}
                    {r.settingsUsed.quotaMode && <> · {t('summary.quotas')}: {r.settingsUsed.quotas.map((q) => `${q.subgroup} ${q.winners}+${q.alternates}`).join(', ')}</>}
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
                  <h3>{t('result.winners')}</h3>
                  {r.winners.map((w) => (
                    <div key={`${w.id}-${w.position}`}>
                      <strong>{w.position}.</strong> {w.name} <span className="muted">({w.id} · {w.subgroup}){w.prize ? ` · 🏆 ${w.prize}` : ''}</span>
                    </div>
                  ))}
                  {r.alternates.length > 0 && (
                    <>
                      <h3 style={{ marginTop: 10 }}>{t('result.alternates')}</h3>
                      {r.alternates.map((a, i) => (
                        <div key={`${a.id}-${i}`}>
                          <strong>{i + 1}.</strong> {a.name} <span className="muted">({a.id} · {a.subgroup})</span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {totals.total.length > 0 && (
        <div className="card">
          <h2>{t('summary.bySubgroup')}</h2>
          <table className="t">
            <thead>
              <tr>
                <th>{t('event.groups')}</th>
                <th>{t('summary.subgroup')}</th>
                <th>{t('result.winners')}</th>
                <th>{t('result.alternates')}</th>
              </tr>
            </thead>
            <tbody>
              {totals.byGroup.flatMap((g) =>
                g.rows.map((r) => (
                  <tr key={`${g.groupId}-${r.subgroup}`}>
                    <td>{g.groupName}</td>
                    <td>{r.subgroup}</td>
                    <td>{r.winners}</td>
                    <td>{r.alternates}</td>
                  </tr>
                ))
              )}
              {totals.total.map((r) => (
                <tr key={`t-${r.subgroup}`} style={{ fontWeight: 700, background: '#faf8fd' }}>
                  <td>{t('summary.total')}</td>
                  <td>{r.subgroup}</td>
                  <td>{r.winners}</td>
                  <td>{r.alternates}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
