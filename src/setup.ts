// One-tap setup links: https://…/plant-care-app/#setup=<Pl@ntNet key>
// The key sits after "#", which browsers never send to the server, so it isn't logged by GitHub.
import { getSetting, setSetting } from './db'

const PARAM = 'setup'
const APP_URL = 'https://fabriziocasanova97.github.io/plant-care-app/'

/** Pl@ntNet keys are short runs of letters and digits; reject anything else (typos, stray text). */
function cleanKey(raw: string | null | undefined): string | null {
  const k = (raw ?? '').trim()
  return /^[A-Za-z0-9_-]{10,100}$/.test(k) ? k : null
}

/** The key inside a setup link, or null. Accepts a whole link or just the "#setup=…" part. */
export function keyFromLink(text: string): string | null {
  const hash = text.includes('#') ? text.slice(text.indexOf('#') + 1) : ''
  return cleanKey(new URLSearchParams(hash).get(PARAM))
}

export function buildSetupLink(key: string): string {
  return `${APP_URL}#${PARAM}=${encodeURIComponent(key.trim())}`
}

export type SetupResult = 'saved' | 'same' | 'declined' | 'invalid' | null

/**
 * If the page was opened from a setup link, save its key and remove it from the address bar
 * (so it isn't kept in history, bookmarks or screenshots). Asks before replacing a different key.
 */
export async function applySetupLinkFromUrl(): Promise<SetupResult> {
  if (!location.hash.includes(`${PARAM}=`)) return null
  const key = keyFromLink(location.href)
  history.replaceState(history.state, '', location.pathname + location.search)
  if (!key) return 'invalid'
  const current = await getSetting('plantnetKey')
  if (current === key) return 'same'
  if (current && !confirm('This phone already has a different Pl@ntNet key. Replace it with the one from this link?')) return 'declined'
  await setSetting('plantnetKey', key)
  return 'saved'
}

/** Open the share sheet with the setup link, or copy it when sharing isn't available. */
export async function shareSetupLink(key: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const url = buildSetupLink(key)
  const text = 'Tap this to set up photo identification in Plant Pal:'
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Plant Pal setup', text, url })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
