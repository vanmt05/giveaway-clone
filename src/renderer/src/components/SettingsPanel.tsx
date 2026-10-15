import { useTranslation } from 'react-i18next'
import type { AnimationKind, GroupSettings, SubgroupQuota } from '../lib/types'
import { normSub } from '../lib/normalize'

type Props = {
  settings: GroupSettings
  onChange: (patch: Partial<GroupSettings>) => void
  /** distinct subgroup labels available (with row counts) */
  subgroups: { subgroup: string; count: number }[]
  disabled?: boolean
}

const lines = (s: string): string[] => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)

function Num({ value, min = 0, onChange, label, disabled }: { value: number; min?: number; label: string; disabled?: boolean; onChange: (n: number) => void }): React.JSX.Element {
  return (
    <span className="stepper">
      <button className="btn small" type="button" disabled={disabled || value <= min} aria-label={`${label} −`} onClick={() => onChange(value - 1)}>
        −
      </button>
      <input
        className="input"
        type="number"
        min={min}
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.floor(Number(e.target.value) || 0)))}
      />
      <button className="btn small" type="button" disabled={disabled} aria-label={`${label} +`} onClick={() => onChange(value + 1)}>
        +
      </button>
    </span>
  )
}

export default function SettingsPanel({ settings: s, onChange, subgroups, disabled }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const allSelected = s.subgroupFilter === 'all'
  const selected = new Set(allSelected ? subgroups.map((x) => normSub(x.subgroup)) : (s.subgroupFilter as string[]).map(normSub))

  const toggleSub = (label: string): void => {
    const k = normSub(label)
    const next = new Set(selected)
    next.has(k) ? next.delete(k) : next.add(k)
    const pick = subgroups.filter((x) => next.has(normSub(x.subgroup))).map((x) => x.subgroup)
    onChange({ subgroupFilter: pick.length === subgroups.length ? 'all' : pick })
  }

  const quotaOf = (label: string): SubgroupQuota =>
    s.quotas.find((q) => normSub(q.subgroup) === normSub(label)) ?? { subgroup: label, winners: 0, alternates: 0 }
  const setQuota = (label: string, patch: Partial<SubgroupQuota>): void => {
    const rest = s.quotas.filter((q) => normSub(q.subgroup) !== normSub(label))
    onChange({ quotas: [...rest, { ...quotaOf(label), ...patch, subgroup: label }] })
  }
  const fill = (w: number, a: number): void =>
    onChange({
      quotas: subgroups.filter((x) => selected.has(normSub(x.subgroup))).map((x) => ({ subgroup: x.subgroup, winners: w, alternates: a }))
    })

  const anims: AnimationKind[] = ['countdown', 'spinner', 'wheel']

  return (
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="row">
        <div className="field">
          <label>{t('settings.winners')}</label>
          <Num label={t('settings.winners')} min={1} value={s.winners} disabled={s.quotaMode} onChange={(n) => onChange({ winners: n })} />
        </div>
        <div className="field">
          <label>{t('settings.alternates')}</label>
          <Num label={t('settings.alternates')} value={s.alternates} disabled={s.quotaMode} onChange={(n) => onChange({ alternates: n })} />
        </div>
      </div>

      <div className="field">
        <label className="check">
          <input type="checkbox" checked={s.dedupe} onChange={(e) => onChange({ dedupe: e.target.checked })} />
          {t('settings.dedupe')}
        </label>
        <span className="hint">{t('settings.dedupeHint')}</span>
      </div>

      <div className="field">
        <label>{t('settings.subgroupFilter')}</label>
        {subgroups.length === 0 ? (
          <span className="hint">{t('settings.noSubgroups')}</span>
        ) : (
          <div className="chips">
            <button type="button" className={`chip ${allSelected ? 'on' : ''}`} onClick={() => onChange({ subgroupFilter: 'all' })}>
              {t('settings.all')}
            </button>
            {subgroups.map((x) => (
              <button
                type="button"
                key={x.subgroup}
                className={`chip ${!allSelected && selected.has(normSub(x.subgroup)) ? 'on' : ''}`}
                onClick={() => toggleSub(x.subgroup)}
              >
                {x.subgroup} ({x.count})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label className="check">
          <input type="checkbox" checked={s.quotaMode} onChange={(e) => onChange({ quotaMode: e.target.checked })} />
          {t('settings.quotaMode')}
        </label>
        <span className="hint">{t('settings.quotaHint')}</span>
        {s.quotaMode && (
          <>
            <span className="hint">{t('settings.quotaIgnored')}</span>
            <div className="row">
              <QuotaFill label={t('settings.perSubgroup')} apply={t('settings.fillAll')} onFill={fill} />
            </div>
            <table className="t">
              <thead>
                <tr>
                  <th>{t('summary.subgroup')}</th>
                  <th>{t('settings.winners')}</th>
                  <th>{t('settings.alternates')}</th>
                </tr>
              </thead>
              <tbody>
                {subgroups
                  .filter((x) => selected.has(normSub(x.subgroup)))
                  .map((x) => {
                    const q = quotaOf(x.subgroup)
                    return (
                      <tr key={x.subgroup}>
                        <td>
                          {x.subgroup} <span className="muted">({x.count})</span>
                        </td>
                        <td>
                          <Num label={`${x.subgroup} ${t('settings.winners')}`} value={q.winners} onChange={(n) => setQuota(x.subgroup, { winners: n })} />
                        </td>
                        <td>
                          <Num label={`${x.subgroup} ${t('settings.alternates')}`} value={q.alternates} onChange={(n) => setQuota(x.subgroup, { alternates: n })} />
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="field">
        <label>{t('settings.prizes')}</label>
        <textarea value={s.prizes.join('\n')} onChange={(e) => onChange({ prizes: e.target.value.split(/\r?\n/) })} onBlur={(e) => onChange({ prizes: lines(e.target.value) })} />
      </div>
      <div className="row">
        <div className="field grow">
          <label>{t('settings.excludeIds')}</label>
          <textarea value={s.excludeIds.join('\n')} onChange={(e) => onChange({ excludeIds: e.target.value.split(/\r?\n/) })} onBlur={(e) => onChange({ excludeIds: lines(e.target.value) })} />
        </div>
        <div className="field grow">
          <label>{t('settings.bonusIds')}</label>
          <textarea value={s.bonusIds.join('\n')} onChange={(e) => onChange({ bonusIds: e.target.value.split(/\r?\n/) })} onBlur={(e) => onChange({ bonusIds: lines(e.target.value) })} />
        </div>
      </div>

      <div className="field">
        <label>{t('settings.animation')}</label>
        <div className="chips">
          {anims.map((a) => (
            <button type="button" key={a} className={`chip ${s.animation === a ? 'on' : ''}`} onClick={() => onChange({ animation: a })}>
              {t(`settings.${a}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>
          {t('settings.duration')}: {s.durationSec}
        </label>
        <input type="range" min={3} max={30} value={s.durationSec} onChange={(e) => onChange({ durationSec: Number(e.target.value) })} />
      </div>
    </fieldset>
  )
}

function QuotaFill({ label, apply, onFill }: { label: string; apply: string; onFill: (w: number, a: number) => void }): React.JSX.Element {
  // local uncontrolled inputs keep the panel stateless
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        onFill(Math.max(0, Number(f.get('w')) || 0), Math.max(0, Number(f.get('a')) || 0))
      }}
    >
      <span className="muted">{label}:</span>
      <input className="input" style={{ width: 70 }} name="w" type="number" min={0} defaultValue={1} aria-label="winners" />
      <input className="input" style={{ width: 70 }} name="a" type="number" min={0} defaultValue={0} aria-label="alternates" />
      <button className="btn small" type="submit">
        {apply}
      </button>
    </form>
  )
}
