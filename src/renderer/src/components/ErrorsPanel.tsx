import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RejectedRow } from '../lib/types'

type Props = {
  rejected: RejectedRow[]
  onFix: (row: number, cells: { id: string; name: string; subgroup: string }) => void
  onRemove: (row: number) => void
}

function Row({ r, onFix, onRemove }: { r: RejectedRow } & Omit<Props, 'rejected'>): React.JSX.Element {
  const { t } = useTranslation()
  const [c, setC] = useState(r.cells)
  return (
    <tr>
      <td>{r.row}</td>
      {(['id', 'name', 'subgroup'] as const).map((k) => (
        <td key={k}>
          <input
            className="input"
            type="text"
            aria-label={`${t('group.row')} ${r.row} ${k}`}
            value={c[k]}
            style={!c[k].trim() ? { borderColor: 'var(--err)' } : undefined}
            onChange={(e) => setC({ ...c, [k]: e.target.value })}
          />
        </td>
      ))}
      <td>
        <span className="pill err">{r.reasons.map((x) => t(`group.reason.${x}`)).join(', ')}</span>
      </td>
      <td className="row">
        <button className="btn small primary" onClick={() => onFix(r.row, c)}>
          {t('group.fix')}
        </button>
        <button className="btn small danger" onClick={() => onRemove(r.row)}>
          {t('group.removeRow')}
        </button>
      </td>
    </tr>
  )
}

export default function ErrorsPanel({ rejected, onFix, onRemove }: Props): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!rejected.length) return null
  return (
    <div className="card" style={{ borderColor: 'var(--err)' }}>
      <h3>
        {t('group.errors')} ({rejected.length})
      </h3>
      <p className="hint">{t('group.errorsHint')}</p>
      <div style={{ overflow: 'auto', maxHeight: 280 }}>
        <table className="t">
          <thead>
            <tr>
              <th>{t('group.row')}</th>
              <th>ID</th>
              <th>{t('mapping.name')}</th>
              <th>{t('mapping.subgroup')}</th>
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {rejected.map((r) => (
              <Row key={`${r.row}:${r.cells.id}:${r.cells.name}:${r.cells.subgroup}`} r={r} onFix={onFix} onRemove={onRemove} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
