// Three made-up plants for trying the app. Names, dates, notes and photos are all invented
// test data, and every one is marked "Test" so it can be removed in one tap. The care
// information they link to is the real NC State profile, as for any plant.
import { db, clearSamplePlants } from './db'
import { getPlant } from './data/ncsu'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (d: number, hour = 9) => {
  const t = new Date()
  t.setDate(t.getDate() - d)
  t.setHours(hour, 0, 0, 0)
  return t.getTime()
}

interface Sample {
  slug: string
  nickname: string
  intervalDays: number
  /** Days ago for each watering, newest last. */
  waterings: number[]
  /** Days ago for each photo, oldest first. */
  photos: number[]
  note: string
  attention: boolean
  hue: number
}

const SAMPLES: Sample[] = [
  {
    slug: 'epipremnum-aureum', nickname: 'Pothos (test)', intervalDays: 7,
    waterings: [30, 23, 16, 9], photos: [45, 20, 2],
    note: 'Test plant. Hanging by the kitchen window. New vine since September.', attention: false, hue: 110,
  },
  {
    slug: 'dracaena-trifasciata', nickname: 'Snake plant (test)', intervalDays: 14,
    waterings: [42, 28, 14], photos: [60, 14],
    note: 'Test plant. Bedroom corner, low light. Barely needs anything.', attention: false, hue: 85,
  },
  {
    slug: 'chlorophytum-comosum', nickname: 'Spider plant (test)', intervalDays: 5,
    waterings: [12, 7, 2], photos: [30, 1],
    note: 'Test plant. Leaf tips went brown in October, moved it away from the heater.', attention: true, hue: 130,
  },
]

/** A simple drawn "photo" with a TEST watermark, so nothing real is confused with it. */
function drawSamplePhoto(label: string, dateLabel: string, hue: number, seed: number): Promise<Blob> {
  const size = 640
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = `hsl(${hue + 20} 35% 88%)`
  g.fillRect(0, 0, size, size)
  // pot
  g.fillStyle = '#c9865a'
  g.beginPath(); g.moveTo(200, 430); g.lineTo(440, 430); g.lineTo(410, 600); g.lineTo(230, 600); g.closePath(); g.fill()
  g.fillStyle = '#b4713f'; g.fillRect(185, 405, 270, 30)
  // leaves (deterministic per seed)
  for (let i = 0; i < 9 + (seed % 3); i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.28 + ((seed * 7 + i * 13) % 10) * 0.02
    const len = 150 + ((seed * 31 + i * 17) % 90)
    g.save(); g.translate(320, 410); g.rotate(a)
    g.fillStyle = `hsl(${hue + (i % 3) * 8} ${45 + (i % 2) * 10}% ${32 + (i % 4) * 6}%)`
    g.beginPath(); g.ellipse(len / 2, 0, len / 2, 34, 0, 0, Math.PI * 2); g.fill()
    g.restore()
  }
  // watermark
  g.fillStyle = 'rgba(20,30,22,0.78)'
  g.fillRect(0, size - 90, size, 90)
  g.fillStyle = '#fff'
  g.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  g.fillText(`TEST · ${label}`, 24, size - 50)
  g.font = '26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  g.fillText(dateLabel, 24, size - 16)
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw a sample photo'))), 'image/jpeg', 0.85))
}

/** Replace any earlier samples with a fresh set of three. */
export async function loadSamplePlants() {
  await clearSamplePlants()
  for (const [i, s] of SAMPLES.entries()) {
    const profile = getPlant(s.slug)
    const lastWateredAt = daysAgo(s.waterings[s.waterings.length - 1])
    // A photo that fails to draw is simply skipped; the plant still loads.
    const photos = (await Promise.all(s.photos.map((d, j) =>
      drawSamplePhoto(s.nickname.replace(' (test)', ''), new Date(daysAgo(d)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), s.hue, i * 10 + j)
        .then((blob) => ({ blob, at: daysAgo(d, 15) }), () => null),
    ))).filter((p): p is { blob: Blob; at: number } => p !== null)
    await db.transaction('rw', db.plants, db.waterings, db.photos, async () => {
      const id = await db.plants.add({
        nickname: s.nickname,
        ncsuSlug: profile ? s.slug : null,
        identifiedAs: profile ? { scientificName: profile.scientificName, commonNames: profile.commonNames, score: 0.93 } : null,
        photo: photos[photos.length - 1]?.blob ?? null,
        intervalDays: s.intervalDays,
        lastWateredAt,
        createdAt: daysAgo(Math.max(...s.waterings, ...s.photos)),
        note: s.note,
        attention: s.attention,
        isSample: true,
      })
      await db.waterings.bulkAdd(s.waterings.map((d) => ({ plantId: id as number, at: daysAgo(d) })))
      await db.photos.bulkAdd(photos.map((p) => ({ plantId: id as number, blob: p.blob, at: p.at })))
    })
  }
}
