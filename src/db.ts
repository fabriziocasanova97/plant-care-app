import Dexie, { type EntityTable } from 'dexie'

export interface Plant {
  id?: number
  nickname: string
  /** Slug in the NC State dataset, or null when the plant was not found there. */
  ncsuSlug: string | null
  /** What Pl@ntNet identified (kept even when NC State has no profile). */
  identifiedAs: { scientificName: string; commonNames: string[]; score: number } | null
  /** Latest photo, shown in lists. The full history is in `photos`. */
  photo: Blob | null
  intervalDays: number
  lastWateredAt: number | null
  createdAt: number
  /** Her own note, e.g. where the plant lives. */
  note?: string
  /** She flagged it as needing a closer look. */
  attention?: boolean
  /** Sample plant loaded from Settings to try the app; removable in one tap. */
  isSample?: boolean
}

export interface Watering {
  id?: number
  plantId: number
  at: number
}

export interface Photo {
  id?: number
  plantId: number
  blob: Blob
  at: number
}

export interface Setting {
  key: string
  value: string
}

export const db = new Dexie('plant-pal') as Dexie & {
  plants: EntityTable<Plant, 'id'>
  waterings: EntityTable<Watering, 'id'>
  photos: EntityTable<Photo, 'id'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  plants: '++id, nickname, ncsuSlug, lastWateredAt',
  waterings: '++id, plantId, at',
  settings: 'key',
})

db.version(2).stores({
  plants: '++id, nickname, ncsuSlug, lastWateredAt',
  waterings: '++id, plantId, at',
  photos: '++id, plantId, at',
  settings: 'key',
}).upgrade(async (tx) => {
  // Seed the photo history with each plant's existing photo.
  const plants: Plant[] = await tx.table('plants').toArray()
  for (const p of plants) {
    if (p.photo) await tx.table('photos').add({ plantId: p.id, blob: p.photo, at: p.createdAt })
  }
})

const DAY = 24 * 60 * 60 * 1000

/**
 * Days between waterings once winter mode is applied. `winterFactor` is 0 when winter mode is
 * off, else the extra fraction she chose (0.5 = intervals 50% longer).
 */
export function effectiveInterval(p: Plant, winterFactor = 0): number {
  return Math.max(1, Math.round(p.intervalDays * (1 + winterFactor)))
}

export function nextDue(p: Plant, winterFactor = 0): number | null {
  return p.lastWateredAt === null ? null : p.lastWateredAt + effectiveInterval(p, winterFactor) * DAY
}

/** Whole calendar days until due (so a 1-hour DST shift doesn't matter); negative means overdue, null means never watered. */
export function daysUntilDue(p: Plant, winterFactor = 0, now = Date.now()): number | null {
  const due = nextDue(p, winterFactor)
  if (due === null) return null
  return Math.round((startOfDay(due) - startOfDay(now)) / DAY)
}

/** Needs attention today: overdue, due today, or never watered. */
export function isDue(p: Plant, winterFactor = 0, now = Date.now()): boolean {
  const d = daysUntilDue(p, winterFactor, now)
  return d === null || d <= 0
}

/** Whole calendar days since a timestamp. */
export function daysSince(t: number, now = Date.now()): number {
  return Math.round((startOfDay(now) - startOfDay(t)) / DAY)
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

/** Add a photo to the plant's history and make it the current one. */
export async function addPhoto(plantId: number, blob: Blob, at = Date.now()) {
  await db.transaction('rw', db.plants, db.photos, async () => {
    await db.photos.add({ plantId, blob, at })
    await db.plants.update(plantId, { photo: blob })
  })
}

/** Delete one photo; the plant's current photo becomes the newest remaining one. */
export async function deletePhoto(photoId: number) {
  await db.transaction('rw', db.plants, db.photos, async () => {
    const photo = await db.photos.get(photoId)
    if (!photo) return
    await db.photos.delete(photoId)
    const latest = await db.photos.where('plantId').equals(photo.plantId).reverse().sortBy('at')
    await db.plants.update(photo.plantId, { photo: latest[0]?.blob ?? null })
  })
}

export async function removePlant(plantId: number) {
  await db.transaction('rw', db.plants, db.waterings, db.photos, async () => {
    await db.waterings.where('plantId').equals(plantId).delete()
    await db.photos.where('plantId').equals(plantId).delete()
    await db.plants.delete(plantId)
  })
}

/** Delete every sample plant with its waterings and photos. Real plants are untouched. */
export async function clearSamplePlants() {
  await db.transaction('rw', db.plants, db.waterings, db.photos, async () => {
    const ids = (await db.plants.filter((p) => !!p.isSample).toArray()).map((p) => p.id!)
    await db.waterings.where('plantId').anyOf(ids).delete()
    await db.photos.where('plantId').anyOf(ids).delete()
    await db.plants.bulkDelete(ids)
  })
}

export async function getSetting(key: string): Promise<string | undefined> {
  return (await db.settings.get(key))?.value
}

export async function setSetting(key: string, value: string) {
  await db.settings.put({ key, value })
}

// Winter mode: Nov–Feb in Virginia. The app only nudges; she decides.
export const WINTER_MONTHS = new Set([10, 11, 0, 1])
export const WINTER_EXTRA_DEFAULT = 50

/** A key for the current winter season, e.g. "winter-2026", for remembering a dismissed nudge. */
export function seasonKey(now = new Date()): string {
  const m = now.getMonth()
  const y = now.getFullYear()
  return WINTER_MONTHS.has(m) ? `winter-${m >= 10 ? y : y - 1}` : `summer-${y}`
}
