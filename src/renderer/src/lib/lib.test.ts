import { describe, expect, it } from 'vitest'
import { normId, normSub } from './normalize'
import { Rng, newSeed } from './rng'
import { detectMapping } from './mapping'
import { parseDelimited } from './parse'
import { buildEntries, splitByGroup, toDataRows } from './validate'
import { runDraw } from './draw'
import {
  defaultSettings,
  drawAll,
  drawGroup,
  overlapReport,
  replaceWinner,
  subgroupTotals,
  verifyGroup
} from './event'
import type { Entry, EventDoc, Group, GroupSettings } from './types'

const SEED = 'ab'.repeat(32)

const mkEntries = (n: number, subs = ['Ventas', 'TI']): Entry[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `ID${i + 1}`,
    name: `Persona ${i + 1}`,
    subgroup: subs[i % subs.length],
    row: i + 2
  }))

const settings = (over: Partial<GroupSettings> = {}): GroupSettings => ({ ...defaultSettings(), ...over })

const mkGroup = (name: string, entries: Entry[]): Group => ({
  id: name,
  name,
  entries,
  rejected: [],
  warnings: [],
  overrides: {}
})

const mkEvent = (groups: Group[], defaults: Partial<GroupSettings> = {}): EventDoc => ({
  id: 'e1',
  title: 'Prueba',
  createdAt: '2026-01-01T00:00:00.000Z',
  defaults: settings(defaults),
  branding: { color: '#8a2091' },
  groups
})

describe('normalize', () => {
  it('normId drops whitespace and uppercases', () => expect(normId(' ab 12 ')).toBe('AB12'))
  it('normSub ignores case, accents and extra spaces', () => {
    expect(normSub('  Área   Médica ')).toBe(normSub('area medica'))
  })
})

describe('parse + mapping + validate', () => {
  it('parses CSV with quotes, CRLF, blank rows and BOM', () => {
    const t = parseDelimited('﻿Cédula,Nombre,Departamento\r\n1,"Pérez, José",TI\r\n\r\n2,Ana,Ventas\r\n')
    expect(t).toEqual([
      ['Cédula', 'Nombre', 'Departamento'],
      ['1', 'Pérez, José', 'TI'],
      ['2', 'Ana', 'Ventas']
    ])
  })
  it('detects tab (Excel paste) and semicolon delimiters', () => {
    expect(parseDelimited('1\tAna\tTI\n2\tLuis\tVentas')[1]).toEqual(['2', 'Luis', 'Ventas'])
    expect(parseDelimited('1;Ana;TI\n2;Luis;Ventas')[0]).toEqual(['1', 'Ana', 'TI'])
  })
  it('auto-detects headers (Spanish aliases) and falls back to positions', () => {
    const a = detectMapping(['Cédula', 'Nombre', 'Departamento', 'Grupo'], 4)
    expect(a).toEqual({ hasHeader: true, map: { id: 0, name: 1, subgroup: 2, group: 3 } })
    const b = detectMapping(['1', 'Ana', 'TI'], 3)
    expect(b).toEqual({ hasHeader: false, map: { id: 0, name: 1, subgroup: 2, group: -1 } })
  })
  it('rejects rows missing any required column with the source row number', () => {
    const t = parseDelimited('ID,Nombre,Subgrupo\n1,Ana,TI\n2,Luis,\n,Eva,TI\n4,,TI')
    const { map, hasHeader } = detectMapping(t[0], 3)
    const r = buildEntries(toDataRows(t, hasHeader), map)
    expect(r.entries).toHaveLength(1)
    expect(r.rejected.map((x) => [x.row, x.reasons])).toEqual([
      [3, ['missing_subgroup']],
      [4, ['missing_id']],
      [5, ['missing_name']]
    ])
  })
  it('warns on same ID with different names (first kept) and on multi-subgroup IDs', () => {
    const t = parseDelimited('id,nombre,subgrupo\n1,Ana,TI\n1,Anita,Ventas')
    const { map, hasHeader } = detectMapping(t[0], 3)
    const r = buildEntries(toDataRows(t, hasHeader), map)
    expect(r.entries.map((e) => e.name)).toEqual(['Ana', 'Ana'])
    expect(r.warnings.map((w) => w.type).sort()).toEqual(['id_multi_subgroup', 'id_name_conflict'])
  })
  it('splits by the optional Grupo column', () => {
    const t = parseDelimited('id,nombre,subgrupo,grupo\n1,Ana,TI,A\n2,Luis,TI,B\n3,Eva,TI,A')
    const { map, hasHeader } = detectMapping(t[0], 4)
    const parts = splitByGroup(toDataRows(t, hasHeader), map, 'X')
    expect(parts.map((p) => [p.name, p.rows.length])).toEqual([['A', 2], ['B', 1]])
  })
})

describe('rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = new Rng(SEED).shuffle([1, 2, 3, 4, 5, 6, 7, 8])
    expect(new Rng(SEED).shuffle([1, 2, 3, 4, 5, 6, 7, 8])).toEqual(a)
    expect(new Rng(newSeed()).shuffle([1, 2, 3, 4, 5, 6, 7, 8])).not.toEqual(undefined)
  })
  it('int() is uniform (chi-square, 10 buckets, 100k draws)', () => {
    const rng = new Rng(SEED)
    const counts = new Array(10).fill(0)
    for (let i = 0; i < 100_000; i++) counts[rng.int(10)]++
    const exp = 10_000
    const chi = counts.reduce((s, c) => s + (c - exp) ** 2 / exp, 0)
    expect(chi).toBeLessThan(27.88) // df=9, p=0.001
  })
  it('first-place frequency over many seeded draws is uniform', () => {
    const entries = mkEntries(10, ['A'])
    const counts = new Array(10).fill(0)
    for (let i = 0; i < 20_000; i++) {
      const out = runDraw({ entries, settings: settings(), excludedIds: [], rng: new Rng(newSeed()) })
      counts[Number(out.winners[0].id.slice(2)) - 1]++
    }
    const exp = 2000
    const chi = counts.reduce((s, c) => s + (c - exp) ** 2 / exp, 0)
    expect(chi).toBeLessThan(27.88)
  })
})

describe('runDraw', () => {
  const entries = mkEntries(12)
  it('same seed + rows + exclusions give identical winners; winners/alternates disjoint', () => {
    const s = settings({ winners: 3, alternates: 2 })
    const a = runDraw({ entries, settings: s, excludedIds: ['ID1'], rng: new Rng(SEED) })
    const b = runDraw({ entries, settings: s, excludedIds: ['ID1'], rng: new Rng(SEED) })
    expect(a).toEqual(b)
    const ids = [...a.winners, ...a.alternates].map((e) => e.id)
    expect(new Set(ids).size).toBe(5)
    expect(ids).not.toContain('ID1')
  })
  it('a repeated ID never takes two slots, with or without dedupe', () => {
    const dup = [...mkEntries(4), ...mkEntries(4)]
    for (const dedupe of [false, true]) {
      const out = runDraw({ entries: dup, settings: settings({ winners: 4, dedupe }), excludedIds: [], rng: new Rng(SEED) })
      expect(new Set(out.winners.map((w) => w.id)).size).toBe(4)
    }
  })
  it('dedupe gives each ID an equal chance; tickets give repeated IDs a higher one', () => {
    const rows: Entry[] = [
      { id: 'A', name: 'A', subgroup: 's', row: 1 },
      { id: 'A', name: 'A', subgroup: 's', row: 2 },
      { id: 'A', name: 'A', subgroup: 's', row: 3 },
      { id: 'B', name: 'B', subgroup: 's', row: 4 }
    ]
    const share = (dedupe: boolean): number => {
      let a = 0
      for (let i = 0; i < 4000; i++) {
        const w = runDraw({ entries: rows, settings: settings({ dedupe }), excludedIds: [], rng: new Rng(newSeed()) })
        if (w.winners[0].id === 'A') a++
      }
      return a / 4000
    }
    expect(share(false)).toBeGreaterThan(0.65) // ~0.75
    expect(Math.abs(share(true) - 0.5)).toBeLessThan(0.05)
  })
  it('subgroup filter excludes unchecked subgroups', () => {
    const out = runDraw({
      entries,
      settings: settings({ winners: 6, subgroupFilter: ['ventas'] }),
      excludedIds: [],
      rng: new Rng(SEED)
    })
    expect(out.winners).toHaveLength(6)
    expect(out.winners.every((w) => w.subgroup === 'Ventas')).toBe(true)
  })
  it('exclude list and bonus tickets work by ID', () => {
    const out = runDraw({
      entries: mkEntries(3, ['A']),
      settings: settings({ winners: 3, excludeIds: [' id2 '] }),
      excludedIds: [],
      rng: new Rng(SEED)
    })
    expect(out.winners.map((w) => w.id).sort()).toEqual(['ID1', 'ID3'])
    expect(out.shortfall).toEqual([{ subgroup: undefined, role: 'winner', missing: 1 }])
    const rows = mkEntries(2, ['A'])
    let bonusWins = 0
    for (let i = 0; i < 3000; i++) {
      const w = runDraw({ entries: rows, settings: settings({ bonusIds: ['ID1'] }), excludedIds: [], rng: new Rng(newSeed()) })
      if (w.winners[0].id === 'ID1') bonusWins++
    }
    expect(bonusWins / 3000).toBeGreaterThan(0.6) // ~0.667
  })
  it('quota mode: exactly N per subgroup, prizes by position, shortfall when too small', () => {
    const e = [...mkEntries(8, ['Ventas', 'TI']), ...mkEntries(1, ['Legal']).map((x) => ({ ...x, id: 'L1' }))]
    const out = runDraw({
      entries: e,
      settings: settings({
        quotaMode: true,
        prizes: ['Oro', 'Plata'],
        quotas: [
          { subgroup: 'Ventas', winners: 2, alternates: 1 },
          { subgroup: 'TI', winners: 2, alternates: 0 },
          { subgroup: 'Legal', winners: 2, alternates: 0 }
        ]
      }),
      excludedIds: [],
      rng: new Rng(SEED)
    })
    const by = (s: string): number => out.winners.filter((w) => w.subgroup === s).length
    expect([by('Ventas'), by('TI'), by('Legal')]).toEqual([2, 2, 1])
    expect(out.alternates.filter((a) => a.subgroup === 'Ventas')).toHaveLength(1)
    expect(out.shortfall).toEqual([{ subgroup: 'Legal', role: 'winner', missing: 1 }])
    expect(out.winners.filter((w) => w.subgroup === 'TI').map((w) => w.prize)).toEqual(['Oro', 'Plata'])
  })
  it('quota mode never picks an ID twice when it sits in two subgroups', () => {
    const e: Entry[] = [
      { id: 'X', name: 'X', subgroup: 'A', row: 1 },
      { id: 'X', name: 'X', subgroup: 'B', row: 2 },
      { id: 'Y', name: 'Y', subgroup: 'B', row: 3 }
    ]
    const out = runDraw({
      entries: e,
      settings: settings({
        quotaMode: true,
        quotas: [
          { subgroup: 'A', winners: 1, alternates: 0 },
          { subgroup: 'B', winners: 1, alternates: 0 }
        ]
      }),
      excludedIds: [],
      rng: new Rng(SEED)
    })
    expect(out.winners.map((w) => w.id)).toEqual(['X', 'Y'])
  })
})

describe('event: cross-group rule', () => {
  // 3 groups sharing IDs 1..10, with different name spellings in each group
  const shared = (suffix: string): Entry[] =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i < 10 ? ` id${i + 1} ` : `${suffix}${i}`,
      name: `P${i}${suffix}`,
      subgroup: i % 2 ? 'TI' : 'Ventas',
      row: i + 2
    }))
  const base = (): EventDoc =>
    mkEvent([mkGroup('G1', shared('a')), mkGroup('G2', shared('b')), mkGroup('G3', shared('c'))], {
      winners: 3,
      alternates: 2
    })

  const allIds = (ev: EventDoc): string[] =>
    ev.groups.flatMap((g) => [...g.result!.winners, ...g.result!.alternates].map((e) => normId(e.id)))

  it('drawAll never repeats a normId across winners/alternates of any group', () => {
    for (let i = 0; i < 50; i++) {
      const ev = drawAll(base(), 'pending')
      const ids = allIds(ev)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
  it('still holds after re-drawing a middle group and after replacing winners', () => {
    let ev = drawAll(base(), 'pending')
    for (let i = 0; i < 20; i++) {
      ev = drawGroup(ev, 'G2')
      for (const [gi, wi, why] of [[0, 0, 'no se presentó'], [2, 1, 'descalificado']] as const) {
        try {
          ev = replaceWinner(ev, ev.groups[gi].id, ev.groups[gi].result!.winners[wi].id, why)
        } catch (e) {
          expect((e as Error).message).toBe('no eligible replacement') // pool exhausted: allowed
        }
      }
      const ids = allIds(ev)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
  it('records shortfall when exclusions exhaust a group', () => {
    const small = mkEvent([mkGroup('G1', mkEntries(4, ['A'])), mkGroup('G2', mkEntries(4, ['A']))], {
      winners: 3,
      alternates: 0
    })
    const ev = drawAll(small, 'pending')
    expect(ev.groups[0].result!.winners).toHaveLength(3)
    expect(ev.groups[1].result!.winners).toHaveLength(1)
    expect(ev.groups[1].result!.shortfall).toEqual([{ subgroup: undefined, role: 'winner', missing: 2 }])
  })
  it('drawAll refuses groups with rejected rows; "all" re-draws everything', () => {
    const ev0 = base()
    ev0.groups[1].rejected = [{ row: 2, cells: { id: '', name: 'x', subgroup: 'y' }, reasons: ['missing_id'] }]
    const ev = drawAll(ev0, 'pending')
    expect(ev.groups.map((g) => !!g.result)).toEqual([true, false, true])
    const again = drawAll(drawAll(base(), 'pending'), 'all')
    expect(again.groups.every((g) => g.result)).toBe(true)
  })
  it('replaceWinner promotes the next alternate (same subgroup in quota mode), logs the reason', () => {
    const ev0 = mkEvent([mkGroup('G', mkEntries(10))], { winners: 2, alternates: 2 })
    const ev1 = drawGroup(ev0, 'G', SEED)
    const r = ev1.groups[0].result!
    const out = r.winners[0]
    const alt0 = r.alternates[0]
    const ev2 = replaceWinner(ev1, 'G', out.id, 'ausente')
    const r2 = ev2.groups[0].result!
    expect(r2.winners[0].id).toBe(alt0.id)
    expect(r2.winners[0].position).toBe(out.position)
    expect(r2.alternates).toHaveLength(1)
    expect(r2.replacements[0]).toMatchObject({ reason: 'ausente' })
  })
  it('replaceWinner falls back to a reproducible fresh pick when no alternates remain', () => {
    const mk = (): EventDoc => drawGroup(mkEvent([mkGroup('G', mkEntries(6))], { winners: 2 }), 'G', SEED)
    const a = replaceWinner(mk(), 'G', mk().groups[0].result!.winners[0].id, 'x')
    const b = replaceWinner(mk(), 'G', mk().groups[0].result!.winners[0].id, 'x')
    expect(a.groups[0].result!.winners.map((w) => w.id)).toEqual(b.groups[0].result!.winners.map((w) => w.id))
    const ids = a.groups[0].result!.winners.map((w) => w.id)
    expect(new Set(ids).size).toBe(2)
  })
  it('overlapReport lists IDs present in several groups', () => {
    const rep = overlapReport(base())
    expect(rep).toHaveLength(10)
    expect(rep[0].groups).toEqual(['G1', 'G2', 'G3'])
  })
  it('verifyGroup passes untouched, fails when the list is edited', () => {
    const ev = drawAll(base(), 'pending')
    expect(ev.groups.map((g) => verifyGroup(g).ok)).toEqual([true, true, true])
    const tampered: Group = { ...ev.groups[0], entries: ev.groups[0].entries.slice(1) }
    expect(verifyGroup(tampered)).toEqual({ ok: false, reason: 'list changed' })
  })
  it('subgroupTotals counts winners/alternates per subgroup per group and overall', () => {
    const ev = drawAll(base(), 'pending')
    const t = subgroupTotals(ev)
    expect(t.byGroup).toHaveLength(3)
    const sum = t.total.reduce((s, r) => s + r.winners + r.alternates, 0)
    expect(sum).toBe(15)
  })
})
