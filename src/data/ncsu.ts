import raw from './ncsu-houseplants.json'

export interface NcsuPlant {
  slug: string
  url: string
  scientificName: string
  commonNames: string[]
  previouslyKnownAs: string[]
  description: string[]
  /** "Group » Label" -> values, exactly as printed on the profile page. */
  attributes: Record<string, string[]>
  tags: string[]
}

export const dataset = raw as unknown as {
  source: string
  sourceUrl: string
  fetchedAt: string
  plants: NcsuPlant[]
}

export const SOURCE_NAME = dataset.source

const bySlug = new Map(dataset.plants.map((p) => [p.slug, p]))
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export function getPlant(slug: string): NcsuPlant | undefined {
  return bySlug.get(slug)
}

/**
 * Find the NC State profile for a scientific name. Exact species first, then a synonym
 * ("previously known as"), then a profile whose name starts with the same species
 * (cultivars), then the genus. Returns the match plus how exact it was.
 */
export function findByScientificName(name: string): { plant: NcsuPlant; match: 'species' | 'synonym' | 'cultivar' | 'genus' } | null {
  const n = norm(name)
  if (!n) return null
  const genus = n.split(' ')[0]
  const species = n.split(' ').slice(0, 2).join(' ')

  for (const p of dataset.plants) if (norm(p.scientificName) === n) return { plant: p, match: 'species' }
  for (const p of dataset.plants) if (p.previouslyKnownAs.some((s) => norm(s) === n)) return { plant: p, match: 'synonym' }
  for (const p of dataset.plants) if (norm(p.scientificName).startsWith(species + ' ') || norm(p.scientificName) === species) return { plant: p, match: 'cultivar' }
  for (const p of dataset.plants) if (norm(p.scientificName) === genus) return { plant: p, match: 'genus' }
  return null
}

/** The common name to show: the one matching the query if any, otherwise the first one that isn't just a Latin synonym. */
export function displayName(p: NcsuPlant, query = ''): string {
  const q = norm(query)
  const hit = q && p.commonNames.find((c) => norm(c).includes(q))
  if (hit) return hit
  const genus = norm(p.scientificName).split(' ')[0]
  return p.commonNames.find((c) => !norm(c).startsWith(genus) && !/^[a-z]+ [a-z]+$/.test(norm(c)) ) ?? p.commonNames[0] ?? p.scientificName
}

export function searchPlants(query: string, limit = 20): NcsuPlant[] {
  const q = norm(query)
  if (!q) return []
  return dataset.plants
    .filter((p) => norm(p.scientificName).includes(q) || p.commonNames.some((c) => norm(c).includes(q)))
    .slice(0, limit)
}

/** The attributes most useful for care, in display order. Only keys that exist on the plant are returned. */
export const CARE_KEYS = [
  'Cultural Conditions » Light',
  'Cultural Conditions » Soil Drainage',
  'Cultural Conditions » Soil Texture',
  'Cultural Conditions » Soil pH',
  'Cultural Conditions » USDA Plant Hardiness Zone',
  'Whole Plant Traits » Maintenance',
  'Whole Plant Traits » Growth Rate',
  'Whole Plant Traits » Habit/Form',
  'Attributes » Dimensions',
  'Attributes » Family',
  'Attributes » Country Or Region Of Origin',
  'Attributes » Recommended Propagation Strategy',
  'Attributes » Particularly Resistant To (Insects/Diseases/Other Problems)',
  'Landscape » Resistance To Challenges',
]

export function careAttributes(p: NcsuPlant): [string, string[]][] {
  return CARE_KEYS.filter((k) => p.attributes[k]).map((k) => [k.split(' » ')[1].replace(/ \(.*\)$/, ''), p.attributes[k]])
}

/** The "Poisonous to Humans" section and the "Problems" list, verbatim. */
export function poisonAttributes(p: NcsuPlant): [string, string[]][] {
  const out: [string, string[]][] = []
  if (p.attributes['Landscape » Problems']) out.push(['Problems', p.attributes['Landscape » Problems']])
  for (const [k, v] of Object.entries(p.attributes)) {
    if (k.startsWith('Poisonous to Humans » ')) out.push([k.split(' » ')[1], v])
  }
  return out
}

/** NC State's "<plant> has some common insect/disease problems" lists. */
export function pestAttributes(p: NcsuPlant): [string, string[]][] {
  return Object.entries(p.attributes)
    .filter(([k]) => /^General » .* has some (common |other )?(insect |disease )?problems$/.test(k))
    .map(([k, v]) => [k.replace(/^General » .* has some /, '').replace(/^(.)/, (c) => c.toUpperCase()), v])
}

/** Description paragraphs, minus the course-video credit line. */
export function descriptionParagraphs(p: NcsuPlant): string[] {
  return p.description.filter((d) => !/^VIDEO Created by/i.test(d))
}

export function toxicityTags(p: NcsuPlant): string[] {
  return p.tags.filter((t) => /toxic|poison/.test(t)).map((t) => '#' + t.replace(/-/g, ' '))
}

/** Sentences in the description that talk about water, light, humidity, or fertilizer. */
export function careSentences(p: NcsuPlant): string[] {
  return p.description
    .join(' ')
    .split(/(?<=[.!?])\s+/)
    .filter((s) => /water|moist|dry|drought|humid|light|sun|shade|fertiliz|temperature|degrees|mist/i.test(s))
}
