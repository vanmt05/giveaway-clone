import { describe, expect, it } from 'vitest'
import { applyImport, fixRejectedRow, removeRejectedRow, distinctSubgroups } from './importer'
import { detectMapping } from './mapping'
import { parseDelimited } from './parse'
import { defaultSettings, drawGroup, canDraw } from './event'
import type { EventDoc } from './types'

const ev = (): EventDoc => ({
  id: 'e1',
  title: 'T',
  createdAt: '2026-01-01T00:00:00.000Z',
  defaults: defaultSettings(),
  branding: { color: '#8a2091' },
  groups: [{ id: 'g1', name: 'G1', entries: [], rejected: [], warnings: [], overrides: {} }]
})

const imp = (e: EventDoc, csv: string, mode: 'replace' | 'append' = 'replace', target: string | null = 'g1'): EventDoc => {
  const table = parseDelimited(csv)
  const d = detectMapping(table[0], table[0].length)
  return applyImport(e, { name: 'f', table, targetGroupId: target, mode }, d.map, d.hasHeader)
}

describe('importer', () => {
  it('fills the target group and rejects incomplete rows', () => {
    const e = imp(ev(), 'ID,Nombre,Subgrupo\n1,Ana,TI\n2,Luis,\n3,Eva,TI')
    const g = e.groups[0]
    expect(g.entries.map((x) => x.id)).toEqual(['1', '3'])
    expect(g.rejected.map((r) => r.row)).toEqual([3])
    expect(canDraw(g)).toBe(false)
    expect(() => drawGroup(e, 'g1')).toThrow()
  })
  it('fixing a rejected row moves it into the entries and unblocks drawing', () => {
    const e = imp(ev(), 'ID,Nombre,Subgrupo\n1,Ana,TI\n2,Luis,')
    const fixed = fixRejectedRow(e.groups[0], 3, { id: '2', name: 'Luis', subgroup: 'Ventas' })
    expect(fixed.rejected).toHaveLength(0)
    expect(fixed.entries).toHaveLength(2)
    expect(canDraw(fixed)).toBe(true)
  })
  it('a fix that is still incomplete stays rejected; removing drops it', () => {
    const e = imp(ev(), 'ID,Nombre,Subgrupo\n1,Ana,TI\n2,,')
    const still = fixRejectedRow(e.groups[0], 3, { id: '2', name: 'Luis', subgroup: '' })
    expect(still.rejected.map((r) => r.reasons)).toEqual([['missing_subgroup']])
    expect(removeRejectedRow(still, 3).rejected).toHaveLength(0)
  })
  it('append keeps existing rows; replace discards them', () => {
    const a = imp(ev(), 'ID,Nombre,Subgrupo\n1,Ana,TI')
    expect(imp(a, 'ID,Nombre,Subgrupo\n2,Luis,TI', 'append').groups[0].entries).toHaveLength(2)
    expect(imp(a, 'ID,Nombre,Subgrupo\n2,Luis,TI', 'replace').groups[0].entries.map((x) => x.id)).toEqual(['2'])
  })
  it('a Grupo column creates one group per value and replaces the empty target', () => {
    const e = imp(ev(), 'id,nombre,subgrupo,grupo\n1,Ana,TI,A\n2,Luis,TI,B\n3,Eva,Ventas,A')
    expect(e.groups.map((g) => [g.name, g.entries.length])).toEqual([['A', 2], ['B', 1]])
  })
  it('bulk (no target) creates a group named after the file', () => {
    const e = imp(ev(), 'ID,Nombre,Subgrupo\n1,Ana,TI', 'replace', null)
    expect(e.groups.map((g) => g.name)).toEqual(['G1', 'f'])
  })
  it('distinctSubgroups merges spellings and counts rows', () => {
    const e = imp(ev(), 'ID,Nombre,Subgrupo\n1,Ana,Área A\n2,Luis,area a\n3,Eva,B')
    expect(distinctSubgroups(e.groups)).toEqual([
      { subgroup: 'Área A', count: 2 },
      { subgroup: 'B', count: 1 }
    ])
  })
})
