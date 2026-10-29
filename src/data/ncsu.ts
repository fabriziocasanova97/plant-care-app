import raw from './ncsu-houseplants.json'

export interface NcsuPlant {
  slug: string
  url: string
  scientificName: string
  commonNames: string[]
  /** The common name NC State leads with in its photo captions, when one could be determined. */
  preferredCommonName: string | null
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
  const words = n.split(' ')
  const genus = words[0]

  for (const p of dataset.plants) if (norm(p.scientificName) === n) return { plant: p, match: 'species' }
  for (const p of dataset.plants) if (p.previouslyKnownAs.some((s) => norm(s) === n)) return { plant: p, match: 'synonym' }
  if (words.length >= 2) {
    // "Genus species" given: a cultivar/variety profile of that species counts as a near match.
    const species = words.slice(0, 2).join(' ')
    for (const p of dataset.plants) if (norm(p.scientificName).startsWith(species + ' ')) return { plant: p, match: 'cultivar' }
  }
  // Only a genus-level profile (e.g. "Ficus") is an acceptable genus match, never an arbitrary species of it.
  for (const p of dataset.plants) if (norm(p.scientificName) === genus) return { plant: p, match: 'genus' }
  return null
}

/**
 * The common name to show: the one matching the query if any, else the name NC State leads with
 * in its captions, else the first common name that isn't a Latin synonym.
 */
export function displayName(p: NcsuPlant, query = ''): string {
  const q = norm(query)
  const hit = q && p.commonNames.find((c) => norm(c).includes(q))
  if (hit) return hit
  const latin = norm(p.scientificName)
  const genus = latin.split(' ')[0]
  if (p.preferredCommonName && !latin.includes(norm(p.preferredCommonName))) return p.preferredCommonName
  const synonyms = new Set(p.previouslyKnownAs.map(norm))
  return p.commonNames.find((c) => !norm(c).startsWith(genus) && !synonyms.has(norm(c))) ?? p.commonNames[0] ?? p.scientificName
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

const CARE_WORDS = /\b(water(s|ed|ing)?|moist(ure)?|dry|dries|drought|humid(ity)?|light|sun(light|ny)?|shade|fertiliz\w*|temperature|degrees|mist(ing)?)\b/i
const splitSentences = (text: string) => text.split(/(?<=[.!?])\s+(?=[A-Z•])/)

/** Sentences in the description that talk about water, light, humidity, temperature or fertilizer. */
export function careSentences(p: NcsuPlant): string[] {
  return p.description.flatMap(splitSentences).filter((s) => CARE_WORDS.test(s))
}

/** Description paragraphs with the care sentences removed, so nothing is shown twice. */
export function descriptionParagraphs(p: NcsuPlant): string[] {
  return p.description
    .map((d) => splitSentences(d).filter((s) => !CARE_WORDS.test(s)).join(' '))
    .filter((d) => d.length > 0)
}

export function toxicityTags(p: NcsuPlant): string[] {
  return p.tags.filter((t) => /toxic|poison/.test(t)).map((t) => '#' + t.replace(/-/g, ' '))
}

