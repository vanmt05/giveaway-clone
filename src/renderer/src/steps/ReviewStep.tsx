import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { List, type RowComponentProps } from 'react-window'
import { useStore } from '../state/eventStore'
import { canDraw, collectExcludedIds, drawGroup, effectiveSettings } from '../lib/event'
import { eligibleEntries } from '../lib/draw'
import { distinctSubgroups } from '../lib/importer'
import { normSub } from '../lib/normalize'
import type { Entry } from '../lib/types'

function Row({ index, style, rows }: RowComponentProps<{ rows: Entry[] }>): React.JSX.Element {
  const e = rows[index]
  return (
    <div className="vrow" style={style}>
      <span className="muted">{e.row}</span>
      <span className="mono">{e.id}</span>
      <span>{e.name}</span>
      <span>{e.subgroup}</span>
    </div>
  )
}

export default function ReviewStep({ groupId }: { groupId: string }): React.JSX.Element | null {
  const { t } = useTranslation()
  const { event, update, go } = useStore()
  const [order, setOrder] = useState(0)
  const group = event?.groups.find((g) => g.id === groupId)

  const rows = useMemo(() => {
    if (!group) return []
    // cosmetic shuffle only; `order` just forces a new permutation
    void order
    return order === 0 ? group.entries : group.entries.slice().sort(() => Math.random() - 0.5)
  }, [group, order])

  if (!event || !group) return null
  const s = effectiveSettings(event, group)
  const excluded = collectExcludedIds(event, groupId)
  const eligible = eligibleEntries(group.entries, s, excluded)
  const subs = distinctSubgroups([group])
  const onlySubs = s.subgroupFilter === 'all' ? null : new Set(s.subgroupFilter.map(normSub))
  const quotaW = s.quotas.reduce((a, q) => a + q.winners, 0)
  const quotaA = s.quotas.reduce((a, q) => a + q.alternates, 0)

  const start = (): void => {
    if (!canDraw(group)) return
    update((e) => drawGroup(e, groupId))
    go({ name: 'animate', groupId })
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1>
        {t('review.title')}: {group.name}
      </h1>
      <div className="chips" style={{ marginBottom: 10 }}>
        {subs.map((x) => (
          <span key={x.subgroup} className={`chip ${onlySubs && !onlySubs.has(normSub(x.subgroup)) ? '' : 'on'}`} style={{ cursor: 'default' }}>
            {x.subgroup} ({x.count})
          </span>
        ))}
      </div>
      <p>
        <strong>
          {t('review.total')}: {group.entries.length}
        </strong>{' '}
        · {eligible.length} {t('common.participants')} ·{' '}
        {s.quotaMode ? `${t('review.quota')}: ` : ''}
        {t('review.willDraw', { w: s.quotaMode ? quotaW : s.winners, a: s.quotaMode ? quotaA : s.alternates })}
      </p>
      {excluded.length > 0 && <div className="banner warn">{t('review.excluded', { n: excluded.length })}</div>}
      <div className="card" style={{ padding: 0 }}>
        <div className="vrow vhead" style={{ height: 34 }}>
          <span>{t('group.row')}</span>
          <span>ID</span>
          <span>{t('mapping.name')}</span>
          <span>{t('mapping.subgroup')}</span>
        </div>
        <List rowComponent={Row} rowCount={rows.length} rowHeight={32} rowProps={{ rows }} style={{ height: Math.min(380, Math.max(rows.length, 1) * 32) }} />
      </div>
      <div className="row">
        <button className="btn" onClick={() => go({ name: 'event' })}>
          {t('common.back')}
        </button>
        <button className="btn" onClick={() => setOrder((o) => o + 1)} title={t('review.shuffleHint')}>
          🔀 {t('review.shuffle')}
        </button>
        <span className="hint">{t('review.shuffleHint')}</span>
        <span className="grow" />
        <button className="btn primary big" disabled={!canDraw(group)} onClick={start}>
          {t('review.start')}
        </button>
      </div>
    </div>
  )
}
