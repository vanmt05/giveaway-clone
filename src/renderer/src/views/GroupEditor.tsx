import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { List, type RowComponentProps } from 'react-window'
import type { EventDoc, Group, GroupSettings, Entry } from '../lib/types'
import { canDraw, effectiveSettings } from '../lib/event'
import { distinctSubgroups, fixRejectedRow, removeRejectedRow } from '../lib/importer'
import { parseDelimited } from '../lib/parse'
import { useStore } from '../state/eventStore'
import SettingsPanel from '../components/SettingsPanel'
import ErrorsPanel from '../components/ErrorsPanel'

type Props = {
  event: EventDoc
  group: Group
  onPickFile: (mode: 'replace' | 'append') => void
  onPasteTable: (table: string[][], name: string, mode: 'replace' | 'append') => void
}

function EntryRow({ index, style, entries }: RowComponentProps<{ entries: Entry[] }>): React.JSX.Element {
  const e = entries[index]
  return (
    <div className="vrow" style={style}>
      <span className="muted">{e.row}</span>
      <span className="mono">{e.id}</span>
      <span>{e.name}</span>
      <span>{e.subgroup}</span>
    </div>
  )
}

export default function GroupEditor({ event, group, onPickFile, onPasteTable }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const { update, go, setActiveGroup } = useStore()
  const [paste, setPaste] = useState('')

  const patchGroup = (fn: (g: Group) => Group): void =>
    update((e) => ({ ...e, groups: e.groups.map((g) => (g.id === group.id ? fn(g) : g)) }))

  const eff = effectiveSettings(event, group)
  const custom = Object.keys(group.overrides).length > 0
  const subs = distinctSubgroups([group])
  const draw = canDraw(group)

  const setOverride = (patch: Partial<GroupSettings>): void =>
    patchGroup((g) => ({ ...g, overrides: { ...effectiveSettings(event, g), ...patch }, result: undefined }))

  return (
    <div>
      <div className="card">
        <div className="row">
          <div className="field grow" style={{ marginBottom: 0 }}>
            <label htmlFor="gname">{t('group.name')}</label>
            <input id="gname" className="input" type="text" value={group.name} onChange={(e) => patchGroup((g) => ({ ...g, name: e.target.value }))} />
          </div>
          <span className={`pill ${group.result ? 'ok' : ''}`}>{group.result ? t('event.drawnBadge') : t('event.pending')}</span>
          <button
            className="btn danger"
            onClick={() => {
              if (!window.confirm(t('group.confirmDeleteGroup'))) return
              update((e) => ({ ...e, groups: e.groups.filter((g) => g.id !== group.id) }))
              setActiveGroup(null)
            }}
          >
            {t('group.deleteGroup')}
          </button>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {group.entries.length} {t('common.participants')} · {subs.length} {t('group.subgroupsCount')}
          {group.sourceFile && <> · {t('group.source')}: {group.sourceFile}</>}
        </p>
      </div>

      <div className="card">
        <h3>{t('group.importFile')}</h3>
        <div className="row">
          <button className="btn" onClick={() => onPickFile('replace')}>
            {t('group.replace')}
          </button>
          <button className="btn" onClick={() => onPickFile('append')}>
            {t('group.append')}
          </button>
          <button
            className="btn danger"
            disabled={!group.entries.length && !group.rejected.length}
            onClick={() => patchGroup((g) => ({ ...g, entries: [], rejected: [], warnings: [], result: undefined }))}
          >
            {t('group.clear')}
          </button>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="paste">{t('group.paste')}</label>
          <textarea id="paste" spellCheck={false} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'ID\tNombre\tSubgrupo'} />
          <span className="hint">{t('group.pasteHint')}</span>
        </div>
        <div className="row">
          {(['replace', 'append'] as const).map((mode) => (
            <button
              key={mode}
              className="btn"
              disabled={!paste.trim()}
              onClick={() => {
                onPasteTable(parseDelimited(paste), group.name, mode)
                setPaste('')
              }}
            >
              {t('group.loadPaste')} — {t(`group.${mode}`)}
            </button>
          ))}
        </div>
      </div>

      <ErrorsPanel
        rejected={group.rejected}
        onFix={(row, cells) => patchGroup((g) => fixRejectedRow(g, row, cells))}
        onRemove={(row) => patchGroup((g) => removeRejectedRow(g, row))}
      />

      {group.warnings.length > 0 && (
        <div className="banner warn">
          <strong>{t('group.warnings')}</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {group.warnings.slice(0, 20).map((w, i) => (
              <li key={i}>
                {w.type === 'id_name_conflict'
                  ? t('group.warnNameConflict', { id: w.id, names: w.names.join(' / ') })
                  : t('group.warnMultiSub', { id: w.id, subgroups: w.subgroups.join(' / ') })}
              </li>
            ))}
            {group.warnings.length > 20 && <li>… +{group.warnings.length - 20}</li>}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>{t('group.entries')}</h3>
        {group.entries.length === 0 ? (
          <p className="muted">{t('group.empty')}</p>
        ) : (
          <>
            <div className="vrow vhead">
              <span>{t('group.row')}</span>
              <span>ID</span>
              <span>{t('mapping.name')}</span>
              <span>{t('mapping.subgroup')}</span>
            </div>
            <List rowComponent={EntryRow} rowCount={group.entries.length} rowHeight={32} rowProps={{ entries: group.entries }} style={{ height: Math.min(260, group.entries.length * 32) }} />
          </>
        )}
      </div>

      <div className="card">
        <label className="check" style={{ marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={custom}
            onChange={(e) => patchGroup((g) => ({ ...g, overrides: e.target.checked ? { ...effectiveSettings(event, g) } : {}, result: undefined }))}
          />
          <strong>{t('group.customize')}</strong>
          <span className={`pill ${custom ? 'warn' : ''}`}>{custom ? t('group.custom') : t('group.inherited')}</span>
        </label>
        <SettingsPanel settings={eff} subgroups={subs} disabled={!custom} onChange={setOverride} />
      </div>

      <div className="row">
        <button className="btn primary big" disabled={!draw} onClick={() => go({ name: 'review', groupId: group.id })}>
          {t('group.reviewAndDraw')}
        </button>
        {group.result && (
          <button className="btn big" onClick={() => go({ name: 'result', groupId: group.id })}>
            {t('group.viewResult')}
          </button>
        )}
        {!draw && <span className="hint">{t('group.drawBlocked')}</span>}
      </div>
    </div>
  )
}
