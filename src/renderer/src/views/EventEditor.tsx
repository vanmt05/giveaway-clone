import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { newGroup, useStore } from '../state/eventStore'
import { canDraw, drawAll, overlapReport } from '../lib/event'
import { applyImport, distinctSubgroups, tableOf, type ImportRequest } from '../lib/importer'
import { detectMapping, type ColumnMap } from '../lib/mapping'
import type { GroupSettings } from '../lib/types'
import SettingsPanel from '../components/SettingsPanel'
import MappingDialog from '../components/MappingDialog'
import GroupEditor from './GroupEditor'

type Queued = ImportRequest & { auto: boolean }

export default function EventEditor(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { event, activeGroupId, setActiveGroup, update, go } = useStore()
  const [queue, setQueue] = useState<Queued[]>([])
  const [askDrawAll, setAskDrawAll] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // bulk imports whose columns are fully detected are applied without opening the dialog
  const head = queue[0]
  useEffect(() => {
    if (!head?.auto) return
    const width = Math.max(...head.table.slice(0, 50).map((r) => r.length), 1)
    const d = detectMapping(head.table[0] ?? [], width)
    if (d.hasHeader && d.map.id >= 0 && d.map.name >= 0 && d.map.subgroup >= 0) {
      update((e) => applyImport(e, head, d.map, d.hasHeader))
      setQueue((q) => q.slice(1))
    }
  }, [head, update])

  const overlap = useMemo(() => (event ? overlapReport(event) : []), [event])
  if (!event) return null
  const active = event.groups.find((g) => g.id === activeGroupId) ?? null
  const anyDrawn = event.groups.some((g) => g.result)
  const drawable = event.groups.filter(canDraw)

  const pickFiles = async (targetGroupId: string | null, mode: 'replace' | 'append'): Promise<void> => {
    const files = await window.api.openListFiles()
    if (!files.length) return
    setQueue((q) => [
      ...q,
      ...files.map((f) => ({ name: f.name, table: tableOf(f), targetGroupId, mode, isFile: true, auto: targetGroupId === null && files.length > 1 }))
    ])
  }

  const confirmImport = (map: ColumnMap, hasHeader: boolean): void => {
    if (!head) return
    update((e) => applyImport(e, head, map, hasHeader))
    setQueue((q) => q.slice(1))
  }

  const doDrawAll = (mode: 'pending' | 'all'): void => {
    setAskDrawAll(false)
    update((e) => drawAll(e, mode))
    go({ name: 'summary' })
  }

  const addGroup = (): void => {
    const g = newGroup(`${t('event.untitledGroup')} ${event.groups.length + 1}`)
    update((e) => ({ ...e, groups: [...e.groups, g] }))
    setActiveGroup(g.id)
  }

  const move = (id: string, dir: -1 | 1): void =>
    update((e) => {
      const i = e.groups.findIndex((g) => g.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= e.groups.length) return e
      const gs = e.groups.slice()
      ;[gs[i], gs[j]] = [gs[j], gs[i]]
      return { ...e, groups: gs }
    })

  const patchDefaults = (p: Partial<GroupSettings>): void =>
    update((e) => ({ ...e, defaults: { ...e.defaults, ...p }, groups: e.groups.map((g) => (Object.keys(g.overrides).length ? g : { ...g, result: undefined })) }))

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className={`gitem ${active ? '' : 'active'}`} onClick={() => setActiveGroup(null)} role="button" tabIndex={0}>
          <strong>⚙ {t('event.defaults')}</strong>
        </div>
        <h3 style={{ marginTop: 14 }}>{t('event.groups')}</h3>
        {event.groups.length === 0 && <p className="muted">{t('event.noGroups')}</p>}
        {event.groups.map((g, i) => (
          <div key={g.id} className={`gitem ${active?.id === g.id ? 'active' : ''}`} onClick={() => setActiveGroup(g.id)} role="button" tabIndex={0}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{i + 1}. {g.name}</strong>
              <span>
                <button className="btn small" aria-label="up" disabled={i === 0} onClick={(ev) => (ev.stopPropagation(), move(g.id, -1))}>↑</button>{' '}
                <button className="btn small" aria-label="down" disabled={i === event.groups.length - 1} onClick={(ev) => (ev.stopPropagation(), move(g.id, 1))}>↓</button>
              </span>
            </div>
            <div className="row">
              <span className="muted">{g.entries.length} {t('common.participants')}</span>
              <span className={`pill ${g.result ? 'ok' : ''}`}>{g.result ? t('event.drawnBadge') : t('event.pending')}</span>
              {g.rejected.length > 0 && <span className="pill err">{t('event.rejectedBadge')}</span>}
            </div>
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={addGroup}>＋ {t('event.addGroup')}</button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => void pickFiles(null, 'replace')}>{t('event.importFiles')}</button>
        </div>
        <hr style={{ margin: '14px 0', border: 0, borderTop: '1px solid var(--line)' }} />
        <div className="row">
          <button
            className="btn primary"
            onClick={() => {
              if (!drawable.length) return setNotice(t('event.nothingToDraw'))
              setNotice(null)
              anyDrawn ? setAskDrawAll(true) : doDrawAll('pending')
            }}
          >
            🎲 {t('event.drawAll')}
          </button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => go({ name: 'summary' })}>{t('event.summary')}</button>
          <button className="btn" onClick={() => go({ name: 'verify' })}>{t('event.verify')}</button>
        </div>
        {notice && <div className="banner warn">{notice}</div>}
      </aside>

      <main>
        {active ? (
          <GroupEditor
            key={active.id}
            event={event}
            group={active}
            onPickFile={(mode) => void pickFiles(active.id, mode)}
            onPasteTable={(table, name, mode) => setQueue((q) => [...q, { name, table, targetGroupId: active.id, mode, auto: false }])}
          />
        ) : (
          <>
            <div className="card">
              <div className="field">
                <label htmlFor="etitle">{t('event.editTitle')}</label>
                <input id="etitle" className="input" type="text" value={event.title} onChange={(e) => update((ev) => ({ ...ev, title: e.target.value }))} />
              </div>
              <h2>{t('event.defaults')}</h2>
              <p className="muted">{t('event.defaultsHint')}</p>
              <SettingsPanel settings={event.defaults} subgroups={distinctSubgroups(event.groups)} onChange={patchDefaults} />
            </div>
            <div className="card">
              <h2>{t('event.branding')}</h2>
              <div className="row">
                <label className="check">
                  {t('event.color')}
                  <input type="color" value={event.branding.color} onChange={(e) => update((ev) => ({ ...ev, branding: { ...ev.branding, color: e.target.value } }))} />
                </label>
                <button
                  className="btn"
                  onClick={() =>
                    void window.api.openLogo().then((url) => {
                      if (url) update((ev) => ({ ...ev, branding: { ...ev.branding, logoDataUrl: url } }))
                    })
                  }
                >
                  {t('event.chooseLogo')}
                </button>
                {event.branding.logoDataUrl && (
                  <>
                    <img src={event.branding.logoDataUrl} alt={t('event.logo')} style={{ maxHeight: 40 }} />
                    <button className="btn danger" onClick={() => update((ev) => ({ ...ev, branding: { ...ev.branding, logoDataUrl: undefined } }))}>
                      {t('event.removeLogo')}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="card">
              <h2>{t('event.overlap')}</h2>
              {overlap.length === 0 ? (
                <p className="muted">{t('event.overlapNone')}</p>
              ) : (
                <>
                  <div className="banner warn">{t('event.overlapText')}</div>
                  <p>
                    <strong>{overlap.length}</strong> ID
                  </p>
                  <div style={{ maxHeight: 200, overflow: 'auto' }}>
                    <table className="t">
                      <tbody>
                        {overlap.slice(0, 200).map((o) => (
                          <tr key={o.id}>
                            <td className="mono">{o.id}</td>
                            <td>{o.name}</td>
                            <td>{o.groups.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </main>

      {head && !head.auto && <MappingDialog key={`${head.name}:${queue.length}`} req={head} queueLeft={queue.length - 1} onConfirm={confirmImport} onCancel={() => setQueue((q) => q.slice(1))} />}
      {head?.auto && (() => {
        // auto-queued file whose columns were not fully detected: ask the user
        const w = Math.max(...head.table.slice(0, 50).map((r) => r.length), 1)
        const d = detectMapping(head.table[0] ?? [], w)
        return d.hasHeader && d.map.id >= 0 && d.map.name >= 0 && d.map.subgroup >= 0 ? null : (
          <MappingDialog key={`${head.name}:${queue.length}`} req={head} queueLeft={queue.length - 1} onConfirm={confirmImport} onCancel={() => setQueue((q) => q.slice(1))} />
        )
      })()}

      {askDrawAll && (
        <div className="modal-back" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>{t('event.drawAllTitle')}</h2>
            <p>{t('event.someDrawn')}</p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setAskDrawAll(false)}>{t('common.cancel')}</button>
              <button className="btn" onClick={() => doDrawAll('all')}>{t('event.redoAll')}</button>
              <button className="btn primary" onClick={() => doDrawAll('pending')}>{t('event.onlyPending')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
