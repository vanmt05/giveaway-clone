import type { EventDoc } from './types'
import { subgroupTotals } from './event'

type Role = 'ganador' | 'suplente'

/** CSV / sheet rows: grupo, subgrupo, posición, id, nombre, rol, premio. */
export function resultRows(event: EventDoc, groupId?: string): string[][] {
  const rows: string[][] = []
  for (const g of event.groups) {
    if (groupId && g.id !== groupId) continue
    const r = g.result
    if (!r) continue
    const push = (role: Role, pos: number, e: { id: string; name: string; subgroup: string }, prize?: string): void => {
      rows.push([g.name, e.subgroup, String(pos), e.id, e.name, role, prize ?? ''])
    }
    r.winners.forEach((w) => push('ganador', w.position, w, w.prize))
    r.alternates.forEach((a, i) => push('suplente', i + 1, a))
  }
  return rows
}

export const RESULT_HEADER = ['grupo', 'subgrupo', 'posición', 'id', 'nombre', 'rol', 'premio']

export function csvRows(event: EventDoc): string[][] {
  return [RESULT_HEADER, ...resultRows(event)]
}

export function xlsxSheets(event: EventDoc): { name: string; rows: string[][] }[] {
  const totals = subgroupTotals(event)
  const sheets = [
    { name: 'Resumen', rows: csvRows(event) },
    {
      name: 'Por subgrupo',
      rows: [
        ['grupo', 'subgrupo', 'ganadores', 'suplentes'],
        ...totals.byGroup.flatMap((g) =>
          g.rows.map((r) => [g.groupName, r.subgroup, String(r.winners), String(r.alternates)])
        ),
        ...totals.total.map((r) => ['TOTAL', r.subgroup, String(r.winners), String(r.alternates)])
      ]
    }
  ]
  for (const g of event.groups) {
    if (g.result) sheets.push({ name: g.name, rows: [RESULT_HEADER, ...resultRows(event, g.id)] })
  }
  return sheets
}

export const fileSafe = (s: string): string => s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'sorteo'
