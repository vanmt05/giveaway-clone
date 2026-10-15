export type Entry = { id: string; name: string; subgroup: string; row: number }
export type Winner = Entry & { position: number; prize?: string }

export type SubgroupQuota = { subgroup: string; winners: number; alternates: number }
export type AnimationKind = 'countdown' | 'spinner' | 'wheel'

export type GroupSettings = {
  winners: number
  alternates: number
  dedupe: boolean
  excludeIds: string[]
  bonusIds: string[]
  prizes: string[]
  subgroupFilter: string[] | 'all'
  quotaMode: boolean
  quotas: SubgroupQuota[]
  animation: AnimationKind
  durationSec: number
}

export type Shortfall = { subgroup?: string; role: 'winner' | 'alternate'; missing: number }

export type Replacement = { out: Winner; in: Winner; reason: string; at: string }

export type DrawResult = {
  seed: string
  listHash: string
  participants: number
  excludedIds: string[]
  excludedHash: string
  settingsUsed: GroupSettings
  initial: { winners: Winner[]; alternates: Entry[] }
  winners: Winner[]
  alternates: Entry[]
  replacements: Replacement[]
  drawnAt: string
  shortfall: Shortfall[]
}

export type RejectReason = 'missing_id' | 'missing_name' | 'missing_subgroup'
export type RejectedRow = {
  row: number
  cells: { id: string; name: string; subgroup: string }
  reasons: RejectReason[]
}

export type ImportWarning =
  | { type: 'id_name_conflict'; id: string; names: string[] }
  | { type: 'id_multi_subgroup'; id: string; subgroups: string[] }

export type Group = {
  id: string
  name: string
  entries: Entry[]
  rejected: RejectedRow[]
  warnings: ImportWarning[]
  sourceFile?: string
  overrides: Partial<GroupSettings>
  result?: DrawResult
}

export type Branding = { color: string; logoDataUrl?: string }

export type EventDoc = {
  id: string
  title: string
  createdAt: string
  defaults: GroupSettings
  branding: Branding
  groups: Group[]
}
