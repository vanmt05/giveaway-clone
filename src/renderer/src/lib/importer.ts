import type { EventDoc, Group, RejectedRow } from './types'
import type { ColumnMap } from './mapping'
import { buildEntries, splitByGroup, toDataRows, type DataRow } from './validate'
import { parseDelimited } from './parse'

export type ImportRequest = {
  name: string
  table: string[][]
  /** existing group to fill, or null to create new group(s) */
  targetGroupId: string | null
  mode: 'replace' | 'append'
  /** true when the rows come from a file (so the group records its source) */
  isFile?: boolean
}

export type FileLike = { name: string; table: string[][] | null; text: string | null }

export function tableOf(f: FileLike): string[][] {
  return f.table ?? parseDelimited(f.text ?? '')
}

const POS: ColumnMap = { id: 0, name: 1, subgroup: 2, group: -1 }

/** Rebuild a group's entries/rejected/warnings from existing valid entries + new rows. */
export function rebuildGroup(group: Group, newRows: DataRow[], map: ColumnMap, keepRejected: RejectedRow[]): Group {
  const existing: DataRow[] = group.entries.map((e) => ({ row: e.row, cells: [e.id, e.name, e.subgroup] }))
  const b = buildEntries(newRows, map)
  const all = buildEntries(
    [...existing, ...newRows.map((r) => ({ row: r.row, cells: [r.cells[map.id] ?? '', r.cells[map.name] ?? '', r.cells[map.subgroup] ?? ''] }))],
    POS
  )
  return {
    ...group,
    entries: all.entries,
    rejected: [...keepRejected, ...b.rejected],
    warnings: all.warnings,
    result: undefined
  }
}

let counter = 0
const gid = (): string => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export function applyImport(event: EventDoc, req: ImportRequest, map: ColumnMap, hasHeader: boolean): EventDoc {
  const rows = toDataRows(req.table, hasHeader)
  const parts = splitByGroup(rows, map, req.name)
  const posMap = map

  if (map.group < 0 && req.targetGroupId) {
    const g = event.groups.find((x) => x.id === req.targetGroupId)
    if (g) {
      const base: Group = req.mode === 'replace' ? { ...g, entries: [], rejected: [], warnings: [] } : g
      const next = rebuildGroup(base, parts[0]?.rows ?? [], posMap, base.rejected)
      return {
        ...event,
        groups: event.groups.map((x) => (x.id === g.id ? { ...next, sourceFile: req.isFile ? req.name : next.sourceFile } : x))
      }
    }
  }

  const created: Group[] = parts.map((p) =>
    rebuildGroup(
      { id: gid(), name: p.name, entries: [], rejected: [], warnings: [], overrides: {}, sourceFile: req.isFile ? req.name : undefined },
      p.rows,
      map,
      []
    )
  )
  // an empty target group is replaced by the new ones instead of being left behind
  const target = req.targetGroupId ? event.groups.find((g) => g.id === req.targetGroupId) : undefined
  const drop = target && target.entries.length === 0 && target.rejected.length === 0 ? target.id : null
  return { ...event, groups: [...event.groups.filter((g) => g.id !== drop), ...created] }
}

/** Fix one rejected row from the Errors panel (re-validates the whole group). */
export function fixRejectedRow(group: Group, row: number, cells: { id: string; name: string; subgroup: string }): Group {
  const keep = group.rejected.filter((r) => r.row !== row)
  return rebuildGroup(group, [{ row, cells: [cells.id, cells.name, cells.subgroup] }], POS, keep)
}

export function removeRejectedRow(group: Group, row: number): Group {
  return { ...group, rejected: group.rejected.filter((r) => r.row !== row), result: undefined }
}

export function distinctSubgroups(groups: Group[]): { subgroup: string; count: number }[] {
  const m = new Map<string, { subgroup: string; count: number }>()
  for (const g of groups)
    for (const e of g.entries) {
      const k = e.subgroup.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
      const cur = m.get(k)
      if (cur) cur.count++
      else m.set(k, { subgroup: e.subgroup, count: 1 })
    }
  return [...m.values()].sort((a, b) => a.subgroup.localeCompare(b.subgroup))
}
