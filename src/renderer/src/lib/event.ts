import type { DrawResult, Entry, EventDoc, Group, GroupSettings, Winner } from './types'
import { normId, normSub } from './normalize'
import { Rng, deriveSeed, newSeed } from './rng'
import { eligibleEntries, runDraw } from './draw'
import { excludedHash, listHash } from './hash'

export function defaultSettings(): GroupSettings {
  return {
    winners: 1,
    alternates: 0,
    dedupe: false,
    excludeIds: [],
    bonusIds: [],
    prizes: [],
    subgroupFilter: 'all',
    quotaMode: false,
    quotas: [],
    animation: 'countdown',
    durationSec: 10
  }
}

export function effectiveSettings(event: EventDoc, group: Group): GroupSettings {
  return { ...event.defaults, ...group.overrides }
}

/** normIds of winners AND alternates of every other group that is already drawn. */
export function collectExcludedIds(event: EventDoc, groupId: string): string[] {
  const out = new Set<string>()
  for (const g of event.groups) {
    if (g.id === groupId || !g.result) continue
    g.result.winners.forEach((w) => out.add(normId(w.id)))
    g.result.alternates.forEach((a) => out.add(normId(a.id)))
  }
  return [...out].sort()
}

export function canDraw(group: Group): boolean {
  return group.entries.length > 0 && group.rejected.length === 0
}

function mapGroup(event: EventDoc, groupId: string, fn: (g: Group) => Group): EventDoc {
  return { ...event, groups: event.groups.map((g) => (g.id === groupId ? fn(g) : g)) }
}

export function drawGroup(event: EventDoc, groupId: string, seed: string = newSeed()): EventDoc {
  const group = event.groups.find((g) => g.id === groupId)
  if (!group) throw new Error('group not found')
  if (!canDraw(group)) throw new Error('group has no valid participants or has rejected rows')
  const settings = effectiveSettings(event, group)
  const excludedIds = collectExcludedIds(event, groupId)
  const out = runDraw({ entries: group.entries, settings, excludedIds, rng: new Rng(seed) })
  const result: DrawResult = {
    seed,
    listHash: listHash(group.entries),
    participants: group.entries.length,
    excludedIds,
    excludedHash: excludedHash(excludedIds),
    settingsUsed: settings,
    initial: { winners: out.winners, alternates: out.alternates },
    winners: out.winners,
    alternates: out.alternates,
    replacements: [],
    drawnAt: new Date().toISOString(),
    shortfall: out.shortfall
  }
  return mapGroup(event, groupId, (g) => ({ ...g, result }))
}

/** Draw groups in sidebar order. `pending` keeps existing results; `all` clears them first. */
export function drawAll(event: EventDoc, mode: 'pending' | 'all'): EventDoc {
  let ev: EventDoc =
    mode === 'all' ? { ...event, groups: event.groups.map((g) => ({ ...g, result: undefined })) } : event
  for (const g of ev.groups) {
    if (g.result || !canDraw(g)) continue
    ev = drawGroup(ev, g.id)
  }
  return ev
}

export function clearResult(event: EventDoc, groupId: string): EventDoc {
  return mapGroup(event, groupId, (g) => ({ ...g, result: undefined }))
}

export type OverlapRow = { id: string; name: string; groups: string[] }

/** IDs that appear in more than one group. */
export function overlapReport(event: EventDoc): OverlapRow[] {
  const map = new Map<string, OverlapRow>()
  for (const g of event.groups) {
    const seen = new Set<string>()
    for (const e of g.entries) {
      const k = normId(e.id)
      if (seen.has(k)) continue
      seen.add(k)
      let row = map.get(k)
      if (!row) {
        row = { id: k, name: e.name, groups: [] }
        map.set(k, row)
      }
      row.groups.push(g.name)
    }
  }
  return [...map.values()].filter((r) => r.groups.length > 1)
}

/**
 * Replace a winner: the next alternate (same subgroup in quota mode) is promoted; with none left,
 * a reproducible fresh pick (seed derived from the draw seed) is made from the remaining eligible IDs.
 */
export function replaceWinner(event: EventDoc, groupId: string, winnerId: string, reason: string): EventDoc {
  const group = event.groups.find((g) => g.id === groupId)
  const res = group?.result
  if (!group || !res) throw new Error('group not drawn')
  const key = normId(winnerId)
  const out = res.winners.find((w) => normId(w.id) === key)
  if (!out) throw new Error('winner not found')
  const quota = res.settingsUsed.quotaMode
  const sameSub = (e: Entry): boolean => !quota || normSub(e.subgroup) === normSub(out.subgroup)

  let replacement: Entry | undefined = res.alternates.find(sameSub)
  let alternates = res.alternates
  if (replacement) {
    const rid = normId(replacement.id)
    alternates = res.alternates.filter((a) => normId(a.id) !== rid)
  } else {
    const used = new Set(
      [...res.winners, ...res.alternates, ...res.replacements.map((r) => r.out)].map((e) => normId(e.id))
    )
    const seen = new Set<string>()
    const unique = eligibleEntries(group.entries, res.settingsUsed, [
      ...res.excludedIds,
      ...collectExcludedIds(event, groupId)
    ]).filter((e) => {
      const k = normId(e.id)
      if (used.has(k) || seen.has(k) || !sameSub(e)) return false
      seen.add(k)
      return true
    })
    if (!unique.length) throw new Error('no eligible replacement')
    const rng = new Rng(deriveSeed(res.seed, `replace:${res.replacements.length}`))
    replacement = unique[rng.int(unique.length)]
  }
  const incoming: Winner = { ...replacement, position: out.position, prize: out.prize }
  const result: DrawResult = {
    ...res,
    winners: res.winners.map((w) => (normId(w.id) === key ? incoming : w)),
    alternates,
    replacements: [...res.replacements, { out, in: incoming, reason, at: new Date().toISOString() }]
  }
  return mapGroup(event, groupId, (g) => ({ ...g, result }))
}

export type SubTotal = { subgroup: string; winners: number; alternates: number }

function tally(map: Map<string, SubTotal>, e: Entry, role: 'winners' | 'alternates'): void {
  const k = normSub(e.subgroup)
  let row = map.get(k)
  if (!row) {
    row = { subgroup: e.subgroup, winners: 0, alternates: 0 }
    map.set(k, row)
  }
  row[role]++
}

export function subgroupTotals(event: EventDoc): {
  byGroup: { groupId: string; groupName: string; rows: SubTotal[] }[]
  total: SubTotal[]
} {
  const total = new Map<string, SubTotal>()
  const byGroup = event.groups
    .filter((g) => g.result)
    .map((g) => {
      const m = new Map<string, SubTotal>()
      for (const w of g.result!.winners) {
        tally(m, w, 'winners')
        tally(total, w, 'winners')
      }
      for (const a of g.result!.alternates) {
        tally(m, a, 'alternates')
        tally(total, a, 'alternates')
      }
      const rows = [...m.values()].sort((a, b) => a.subgroup.localeCompare(b.subgroup))
      return { groupId: g.id, groupName: g.name, rows }
    })
  return { byGroup, total: [...total.values()].sort((a, b) => a.subgroup.localeCompare(b.subgroup)) }
}

/** Recompute a group's initial draw from stored list + seed + exclusions and compare. */
export function verifyGroup(group: Group): { ok: boolean; reason?: string } {
  const r = group.result
  if (!r) return { ok: false, reason: 'not drawn' }
  if (listHash(group.entries) !== r.listHash) return { ok: false, reason: 'list changed' }
  if (excludedHash(r.excludedIds) !== r.excludedHash) return { ok: false, reason: 'exclusions changed' }
  const out = runDraw({
    entries: group.entries,
    settings: r.settingsUsed,
    excludedIds: r.excludedIds,
    rng: new Rng(r.seed)
  })
  const sig = (w: Winner[]): string => JSON.stringify(w.map((x) => [normId(x.id), x.position]))
  const sigA = (a: Entry[]): string => JSON.stringify(a.map((x) => normId(x.id)))
  const same = sig(out.winners) === sig(r.initial.winners) && sigA(out.alternates) === sigA(r.initial.alternates)
  return same ? { ok: true } : { ok: false, reason: 'winners differ from recomputation' }
}
