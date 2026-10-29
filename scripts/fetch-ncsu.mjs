// Fetches every houseplant profile from the NC State Extension Gardener Plant Toolbox
// (https://plants.ces.ncsu.edu) and writes the facts, verbatim, to src/data/ncsu-houseplants.json.
//
// Nothing here is written by hand: every field is copied from the profile page it links to.
// Run: node scripts/fetch-ncsu.mjs
import { load } from 'cheerio'
import { mkdir, writeFile } from 'node:fs/promises'

const BASE = 'https://plants.ces.ncsu.edu'
const LIST = `${BASE}/find_a_plant/?tag=houseplant`
const OUT = new URL('../src/data/ncsu-houseplants.json', import.meta.url)
const DELAY_MS = 700 // be polite to a volunteer-run site

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const clean = (s) => s.replace(/\s+/g, ' ').trim()

async function get(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'plant-care-app data fetch (personal use)' } })
    if (res.ok) return res.text()
    if (attempt === 3) throw new Error(`${res.status} ${url}`)
    await sleep(2000 * attempt)
  }
}

async function listSlugs() {
  const slugs = new Set()
  for (let page = 1; page < 50; page++) {
    const html = await get(`${LIST}&page=${page}`)
    const $ = load(html)
    let added = 0
    $('a[href^="/plants/"]').each((_, a) => {
      const m = $(a).attr('href').match(/^\/plants\/([a-z0-9-]+)\/$/)
      if (m && !slugs.has(m[1])) { slugs.add(m[1]); added++ }
    })
    process.stdout.write(`list page ${page}: ${slugs.size} plants\n`)
    if (added === 0) break
    await sleep(DELAY_MS)
  }
  return [...slugs]
}

function parseProfile(slug, html) {
  const $ = load(html)
  const url = `${BASE}/plants/${slug}/`
  const h1 = $('h1').first().clone()
  h1.find('small').remove()
  const scientificName = clean(h1.text())
  const commonNames = $('#common_names li a').map((_, a) => clean($(a).text())).get()
  const previouslyKnownAs = []
  $('h2, h3').each((_, h) => {
    if (/previously known as/i.test($(h).text())) {
      $(h).next('ul').find('li').each((_, li) => previouslyKnownAs.push(clean($(li).text())))
    }
  })

  // Every <dt>/<dd> pair on the page, grouped by its section heading ("Cultural Conditions", "Leaves", ...).
  const attributes = {}
  $('dl').each((_, dl) => {
    const group = clean($(dl).find('.group_name').first().text()).replace(/:$/, '') || 'General'
    let label = null
    $(dl).children('dt, dd').each((_, el) => {
      if (el.tagName === 'dt') {
        label = clean($(el).text()).replace(/:$/, '')
        return
      }
      if (!label) return
      // Keep paragraphs and list items in page order (e.g. "Quick ID Hints:" followed by its bullets).
      const paragraphs = $(el).find('p, li').length
        ? $(el).find('p, li').map((_, p) => ($(p).is('li') ? '• ' : '') + clean($(p).text())).get()
        : [clean($(el).text())]
      const values = paragraphs.filter(Boolean)
      if (!values.length) return
      const key = `${group} » ${label}`
      attributes[key] = [...(attributes[key] ?? []), ...values]
    })
  })

  const description = attributes['General » Description'] ?? []
  delete attributes['General » Description']

  const tags = new Set()
  $('a[href^="/find_a_plant/?tag="]').each((_, a) => {
    tags.add(decodeURIComponent($(a).attr('href').split('tag=')[1]))
  })

  return { slug, url, scientificName, commonNames, previouslyKnownAs, description, attributes, tags: [...tags] }
}

const slugs = await listSlugs()
const plants = []
for (const [i, slug] of slugs.entries()) {
  try {
    const html = await get(`${BASE}/plants/${slug}/`)
    plants.push(parseProfile(slug, html))
    process.stdout.write(`${i + 1}/${slugs.length} ${slug}\n`)
  } catch (e) {
    process.stdout.write(`FAILED ${slug}: ${e.message}\n`)
  }
  await sleep(DELAY_MS)
}

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true })
await writeFile(OUT, JSON.stringify({
  source: 'NC State Extension Gardener Plant Toolbox',
  sourceUrl: LIST,
  fetchedAt: new Date().toISOString(),
  plants,
}, null, 1))
process.stdout.write(`wrote ${plants.length} plants\n`)
