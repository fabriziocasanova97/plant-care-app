import Dexie, { type EntityTable } from 'dexie'

export interface Plant {
  id?: number
  nickname: string
  /** Slug in the NC State dataset, or null when the plant was not found there. */
  ncsuSlug: string | null
  /** What Pl@ntNet identified (kept even when NC State has no profile). */
  identifiedAs: { scientificName: string; commonNames: string[]; score: number } | null
  photo: Blob | null
  intervalDays: number
  lastWateredAt: number | null
  createdAt: number
}

export interface Watering {
  id?: number
  plantId: number
  at: number
}

export interface Setting {
  key: string
  value: string
}

export const db = new Dexie('plant-pal') as Dexie & {
  plants: EntityTable<Plant, 'id'>
  waterings: EntityTable<Watering, 'id'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  plants: '++id, nickname, ncsuSlug, lastWateredAt',
  waterings: '++id, plantId, at',
  settings: 'key',
})

const DAY = 24 * 60 * 60 * 1000

export function nextDue(p: Plant): number | null {
  return p.lastWateredAt === null ? null : p.lastWateredAt + p.intervalDays * DAY
}

/** Whole days until due (calendar days, so a 1-hour DST shift doesn't matter); negative means overdue, null means never watered. */
export function daysUntilDue(p: Plant, now = Date.now()): number | null {
  const due = nextDue(p)
  if (due === null) return null
  return Math.round((startOfDay(due) - startOfDay(now)) / DAY)
}

/** Needs attention today: overdue, due today, or never watered. */
export function isDue(p: Plant, now = Date.now()): boolean {
  const d = daysUntilDue(p, now)
  return d === null || d <= 0
}

export function startOfDay(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export async function markWatered(plantId: number, at = Date.now()) {
  await db.transaction('rw', db.plants, db.waterings, async () => {
    await db.waterings.add({ plantId, at })
    await db.plants.update(plantId, { lastWateredAt: at })
  })
}

export async function getSetting(key: string): Promise<string | undefined> {
  return (await db.settings.get(key))?.value
}

export async function setSetting(key: string, value: string) {
  await db.settings.put({ key, value })
}
