import { useTranslation } from 'react-i18next'
import { useStore } from '../state/eventStore'
import { verifyGroup } from '../lib/event'

export default function VerifyView(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { event, go } = useStore()
  if (!event) return null
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div className="row">
        <button className="btn" onClick={() => go({ name: 'event' })}>
          {t('common.back')}
        </button>
        <h1 style={{ margin: 0 }}>{t('verify.title')}</h1>
      </div>
      <p className="muted">{t('verify.intro')}</p>
      {event.groups.map((g) => {
        const v = g.result ? verifyGroup(g) : null
        return (
          <div className="card" key={g.id}>
            <div className="row">
              <strong className="grow">{g.name}</strong>
              {!v ? (
                <span className="pill">{t('verify.notDrawn')}</span>
              ) : v.ok ? (
                <span className="pill ok">✓ {t('verify.ok')}</span>
              ) : (
                <span className="pill err">✗ {t('verify.fail')}</span>
              )}
            </div>
            {v && !v.ok && <div className="banner err">{t(`verify.reason.${v.reason}`, { defaultValue: v.reason })}</div>}
            {g.result && (
              <p className="hint" style={{ marginBottom: 0 }}>
                {t('cert.seed')}: <span className="mono">{g.result.seed}</span>
                {g.result.replacements.length > 0 && <> · {t('verify.replacementsNote', { n: g.result.replacements.length })}</>}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
