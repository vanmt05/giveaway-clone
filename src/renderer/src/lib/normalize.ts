/** Person identity key: trim, drop all whitespace, uppercase. */
export function normId(id: string): string {
  return id.replace(/\s+/g, '').toUpperCase()
}

/** Subgroup comparison key: case- and accent-insensitive, spaces collapsed. */
export function normSub(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}
