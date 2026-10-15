import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'

export const eventsDir = (): string => join(app.getPath('userData'), 'events')

const safeId = (id: string): string => {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) throw new Error('invalid event id')
  return id
}
const fileFor = (id: string): string => join(eventsDir(), `${safeId(id)}.json`)

/** Atomic write: temp file then rename. */
export async function saveEvent(doc: { id: string }): Promise<void> {
  const path = fileFor(doc.id)
  const tmp = `${path}.${process.pid}.tmp`
  await fs.mkdir(eventsDir(), { recursive: true })
  await fs.writeFile(tmp, JSON.stringify(doc), 'utf8')
  await fs.rename(tmp, path)
}

export async function loadEvent(id: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(fileFor(id), 'utf8'))
  } catch {
    return null
  }
}

export async function deleteEvent(id: string): Promise<void> {
  await fs.rm(fileFor(id), { force: true })
}

export type EventSummary = { id: string; title: string; createdAt: string; groups: number; drawn: number }

export async function listEvents(): Promise<EventSummary[]> {
  await fs.mkdir(eventsDir(), { recursive: true })
  const out: EventSummary[] = []
  for (const f of await fs.readdir(eventsDir())) {
    if (!f.endsWith('.json')) continue
    try {
      const d = JSON.parse(await fs.readFile(join(eventsDir(), f), 'utf8'))
      out.push({
        id: d.id,
        title: d.title,
        createdAt: d.createdAt,
        groups: d.groups.length,
        drawn: d.groups.filter((g: { result?: unknown }) => g.result).length
      })
    } catch {
      /* skip unreadable file */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
