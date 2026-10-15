import type { Entry, ImportWarning, RejectedRow, RejectReason } from './types'
import type { ColumnMap } from './mapping'
import { normId, normSub } from './normalize'

export type DataRow = { row: number; cells: string[] }

/** Drop the header (if any) and number rows as in the source file (1-based). */
export function toDataRows(table: string[][], hasHeader: boolean): DataRow[] {
  return table
    .map((cells, i) => ({ row: i + 1, cells }))
    .slice(hasHeader ? 1 : 0)
}

const cell = (r: DataRow, idx: number): string => (idx >= 0 ? (r.cells[idx] ?? '').trim() : '')

export type BuildResult = { entries: Entry[]; rejected: RejectedRow[]; warnings: ImportWarning[] }

/** All three columns (ID, Nombre, Subgrupo) are required; incomplete rows are rejected. */
export function buildEntries(rows: DataRow[], map: ColumnMap): BuildResult {
  const entries: Entry[] = []
  const rejected: RejectedRow[] = []
  for (const r of rows) {
    const id = cell(r, map.id)
    const name = cell(r, map.name)
    const subgroup = cell(r, map.subgroup)
    const reasons: RejectReason[] = []
    if (!id) reasons.push('missing_id')
    if (!name) reasons.push('missing_name')
    if (!subgroup) reasons.push('missing_subgroup')
    if (reasons.length) rejected.push({ row: r.row, cells: { id, name, subgroup }, reasons })
    else entries.push({ id, name, subgroup, row: r.row })
  }

  // Same ID with different names: first name wins (warn). Same ID in several subgroups: warn only.
  const firstName = new Map<string, string>()
  const rawNames = new Map<string, Set<string>>()
  const subs = new Map<string, Map<string, string>>()
  for (const e of entries) {
    const k = normId(e.id)
    const seen = rawNames.get(k) ?? rawNames.set(k, new Set()).get(k)!
    seen.add(e.name)
    if (!firstName.has(k)) firstName.set(k, e.name)
    else e.name = firstName.get(k)!
    const m = subs.get(k) ?? subs.set(k, new Map()).get(k)!
    const sk = normSub(e.subgroup)
    if (!m.has(sk)) m.set(sk, e.subgroup)
  }
  const warnings: ImportWarning[] = []
  for (const [k, set] of rawNames) {
    if (set.size > 1) warnings.push({ type: 'id_name_conflict', id: k, names: [...set] })
  }
  for (const [k, m] of subs) {
    if (m.size > 1) warnings.push({ type: 'id_multi_subgroup', id: k, subgroups: [...m.values()] })
  }
  return { entries, rejected, warnings }
}

/** Split rows by the optional Grupo column. Rows with no group value go under `fallback`. */
export function splitByGroup(rows: DataRow[], map: ColumnMap, fallback: string): { name: string; rows: DataRow[] }[] {
  if (map.group < 0) return [{ name: fallback, rows }]
  const out = new Map<string, DataRow[]>()
  for (const r of rows) {
    const g = cell(r, map.group) || fallback
    ;(out.get(g) ?? out.set(g, []).get(g)!).push(r)
  }
  return [...out].map(([name, rs]) => ({ name, rows: rs }))
}
