export type ColumnMap = { id: number; name: number; subgroup: number; group: number }

const strip = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/[\s_-]+/g, ' ')

const PATTERNS: Record<keyof ColumnMap, RegExp> = {
  id: /^(id|cedula|codigo|documento|dni|identificacion|legajo)$/,
  name: /^(nombre|nombres|name|participante|nombre completo|full name)$/,
  subgroup: /^(subgrupo|sub grupo|departamento|area|sucursal|subgroup|department)$/,
  group: /^(grupo|group)$/
}

/** Auto-detect columns from a header row. Falls back to positions when no header matches. */
export function detectMapping(firstRow: string[], width: number): { map: ColumnMap; hasHeader: boolean } {
  const map: ColumnMap = { id: -1, name: -1, subgroup: -1, group: -1 }
  let hits = 0
  firstRow.forEach((cell, i) => {
    const key = strip(cell)
    for (const k of Object.keys(PATTERNS) as (keyof ColumnMap)[]) {
      if (map[k] === -1 && PATTERNS[k].test(key)) {
        map[k] = i
        hits++
        break
      }
    }
  })
  if (hits > 0) return { map, hasHeader: true }
  return { map: { id: 0, name: 1, subgroup: 2, group: width >= 4 ? 3 : -1 }, hasHeader: false }
}
