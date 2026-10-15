import type { Entry, GroupSettings, Shortfall, Winner } from './types'
import { normId, normSub } from './normalize'
import type { Rng } from './rng'

export type DrawInput = {
  entries: Entry[]
  settings: GroupSettings
  /** normIds that must not be picked (other groups' winners/alternates). */
  excludedIds: string[]
  rng: Rng
}

export type DrawOutput = { winners: Winner[]; alternates: Entry[]; shortfall: Shortfall[] }

const prizeFor = (prizes: string[], position: number): string | undefined => prizes[position - 1]?.trim() || undefined

function firstPerId(items: Entry[]): Entry[] {
  const seen = new Set<string>()
  return items.filter((e) => {
    const k = normId(e.id)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Tickets -> shuffle -> keep first appearance of each ID. Repeated rows / bonus IDs are extra tickets,
 * so they raise that ID's odds (a design choice: the original shuffles again after de-duplicating,
 * which makes every unique ID equally likely). With dedupe, tickets are reduced to one per ID first;
 * bonus tickets are added after that.
 */
function pickRanked(pool: Entry[], settings: GroupSettings, rng: Rng): Entry[] {
  let tickets = settings.dedupe ? firstPerId(pool) : pool
  const bonus = new Set(settings.bonusIds.map(normId))
  if (bonus.size) tickets = tickets.concat(tickets.filter((e) => bonus.has(normId(e.id))))
  return firstPerId(rng.shuffle(tickets))
}

export function eligibleEntries(entries: Entry[], settings: GroupSettings, excludedIds: string[]): Entry[] {
  const blocked = new Set([...excludedIds, ...settings.excludeIds.map(normId)])
  const allowed = settings.subgroupFilter === 'all' ? null : new Set(settings.subgroupFilter.map(normSub))
  return entries.filter((e) => !blocked.has(normId(e.id)) && (!allowed || allowed.has(normSub(e.subgroup))))
}

function slice(ranked: Entry[], nWin: number, nAlt: number, subgroup: string | undefined, prizes: string[]) {
  const winners: Winner[] = ranked
    .slice(0, nWin)
    .map((e, i) => ({ ...e, position: i + 1, prize: prizeFor(prizes, i + 1) }))
  const alternates = ranked.slice(nWin, nWin + nAlt)
  const shortfall: Shortfall[] = []
  if (winners.length < nWin) shortfall.push({ subgroup, role: 'winner', missing: nWin - winners.length })
  if (alternates.length < nAlt) shortfall.push({ subgroup, role: 'alternate', missing: nAlt - alternates.length })
  return { winners, alternates, shortfall }
}

export function runDraw({ entries, settings, excludedIds, rng }: DrawInput): DrawOutput {
  const pool = eligibleEntries(entries, settings, excludedIds)
  if (!settings.quotaMode) {
    const ranked = pickRanked(pool, settings, rng)
    return slice(ranked, settings.winners, settings.alternates, undefined, settings.prizes)
  }

  // Quota mode: subgroups in alphabetical normSub order, one shared random stream.
  const winners: Winner[] = []
  const alternates: Entry[] = []
  const shortfall: Shortfall[] = []
  const taken = new Set<string>()
  const quotas = [...settings.quotas].sort((a, b) => normSub(a.subgroup).localeCompare(normSub(b.subgroup)))
  for (const q of quotas) {
    const key = normSub(q.subgroup)
    const sub = pool.filter((e) => normSub(e.subgroup) === key && !taken.has(normId(e.id)))
    const r = slice(pickRanked(sub, settings, rng), q.winners, q.alternates, q.subgroup, settings.prizes)
    r.winners.forEach((w) => taken.add(normId(w.id)))
    r.alternates.forEach((a) => taken.add(normId(a.id)))
    winners.push(...r.winners)
    alternates.push(...r.alternates)
    shortfall.push(...r.shortfall)
  }
  return { winners, alternates, shortfall }
}
