import { create } from 'zustand'
import type { EventDoc, Group } from '../lib/types'
import { defaultSettings } from '../lib/event'

export type EventSummary = { id: string; title: string; createdAt: string; groups: number; drawn: number }

export type View =
  | { name: 'home' }
  | { name: 'event' }
  | { name: 'review'; groupId: string }
  | { name: 'animate'; groupId: string }
  | { name: 'result'; groupId: string }
  | { name: 'summary' }
  | { name: 'verify' }

type State = {
  view: View
  event: EventDoc | null
  activeGroupId: string | null
  list: EventSummary[]
  go: (v: View) => void
  setActiveGroup: (id: string | null) => void
  refreshList: () => Promise<void>
  createEvent: (title: string) => Promise<void>
  openEvent: (id: string) => Promise<void>
  duplicateEvent: (id: string) => Promise<void>
  removeEvent: (id: string) => Promise<void>
  /** Apply a pure update to the open event; autosaves. */
  update: (fn: (e: EventDoc) => EventDoc) => void
  closeEvent: () => void
}

export const uid = (): string => globalThis.crypto.randomUUID()

export function newGroup(name: string): Group {
  return { id: uid(), name, entries: [], rejected: [], warnings: [], overrides: {} }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave(get: () => State): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const e = get().event
    if (e) void window.api.events.save(e)
  }, 350)
}

export const useStore = create<State>((set, get) => ({
  view: { name: 'home' },
  event: null,
  activeGroupId: null,
  list: [],
  go: (view) => set({ view }),
  setActiveGroup: (activeGroupId) => set({ activeGroupId }),
  refreshList: async () => set({ list: await window.api.events.list() }),
  createEvent: async (title) => {
    const first = newGroup('Grupo 1')
    const event: EventDoc = {
      id: uid(),
      title: title.trim() || 'Evento',
      createdAt: new Date().toISOString(),
      defaults: defaultSettings(),
      branding: { color: '#8a2091' },
      groups: [first]
    }
    await window.api.events.save(event)
    set({ event, activeGroupId: first.id, view: { name: 'event' } })
  },
  openEvent: async (id) => {
    const e = (await window.api.events.load(id)) as EventDoc | null
    if (!e) return
    set({ event: e, activeGroupId: e.groups[0]?.id ?? null, view: { name: 'event' } })
  },
  duplicateEvent: async (id) => {
    const e = (await window.api.events.load(id)) as EventDoc | null
    if (!e) return
    const copy: EventDoc = {
      ...e,
      id: uid(),
      title: `${e.title} (copia)`,
      createdAt: new Date().toISOString(),
      groups: e.groups.map((g) => ({ ...g, id: uid(), result: undefined }))
    }
    await window.api.events.save(copy)
    await get().refreshList()
  },
  removeEvent: async (id) => {
    await window.api.events.remove(id)
    await get().refreshList()
  },
  update: (fn) => {
    const cur = get().event
    if (!cur) return
    set({ event: fn(cur) })
    scheduleSave(get)
  },
  closeEvent: () => {
    const e = get().event
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (e) void window.api.events.save(e)
    set({ event: null, activeGroupId: null, view: { name: 'home' } })
    void get().refreshList()
  }
}))
