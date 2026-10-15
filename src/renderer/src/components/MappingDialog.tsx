import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { detectMapping, type ColumnMap } from '../lib/mapping'
import type { ImportRequest } from '../lib/importer'

type Props = {
  req: ImportRequest
  queueLeft: number
  onConfirm: (map: ColumnMap, hasHeader: boolean) => void
  onCancel: () => void
}

export default function MappingDialog({ req, queueLeft, onConfirm, onCancel }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const width = Math.max(...req.table.slice(0, 50).map((r) => r.length), 1)
  const det = detectMapping(req.table[0] ?? [], width)
  const [map, setMap] = useState<ColumnMap>(det.map)
  const [hasHeader, setHasHeader] = useState(det.hasHeader)

  const valid = map.id >= 0 && map.name >= 0 && map.subgroup >= 0 && new Set([map.id, map.name, map.subgroup]).size === 3
  const cols = Array.from({ length: width }, (_, i) => i)
  const label = (i: number): string => (hasHeader && req.table[0]?.[i] ? req.table[0][i] : t('mapping.column', { n: i + 1 }))

  const pick = (k: keyof ColumnMap, optional = false) => (
    <div className="field">
      <label>{t(`mapping.${k}`)}</label>
      <select className="input" value={map[k]} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}>
        {optional && <option value={-1}>{t('common.none')}</option>}
        {!optional && map[k] < 0 && <option value={-1}>—</option>}
        {cols.map((i) => (
          <option key={i} value={i}>
            {label(i)}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={t('mapping.title')}>
      <div className="modal">
        <h2>{t('mapping.title')}</h2>
        <p className="muted">
          {t('mapping.file')}: <strong>{req.name}</strong>
          {queueLeft > 0 && <> · {t('mapping.queue', { n: queueLeft })}</>}
        </p>
        <label className="check" style={{ marginBottom: 10 }}>
          <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
          {t('mapping.hasHeader')}
        </label>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">{pick('id')}</div>
          <div className="grow">{pick('name')}</div>
        </div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">{pick('subgroup')}</div>
          <div className="grow">{pick('group', true)}</div>
        </div>
        <h3>{t('mapping.preview')}</h3>
        <div style={{ overflow: 'auto', maxHeight: 180 }}>
          <table className="t">
            <tbody>
              {req.table.slice(0, 6).map((r, ri) => (
                <tr key={ri} style={ri === 0 && hasHeader ? { fontWeight: 700 } : undefined}>
                  {cols.map((c) => (
                    <td key={c}>{r[c] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!valid && <div className="banner warn">{t('mapping.needAll')}</div>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button className="btn primary" disabled={!valid} onClick={() => onConfirm(map, hasHeader)}>
            {t('mapping.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
