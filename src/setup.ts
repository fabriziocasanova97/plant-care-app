// One-tap setup links: https://…/plant-care-app/#claude=<Claude key>  (or #setup=<Pl@ntNet key>)
// The key sits after "#", which browsers never send to the server, so it isn't logged by GitHub.
import { getSetting, setSetting } from './db'

export type KeyKind = 'claude' | 'plantnet'
const KINDS: Record<KeyKind, { param: string; setting: string; label: string }> = {
  claude: { param: 'claude', setting: 'anthropicKey', label: 'Claude' },
  plantnet: { param: 'setup', setting: 'plantnetKey', label: 'Pl@ntNet' },
}
const APP_URL = 'https://fabriziocasanova97.github.io/plant-care-app/'

/** API keys are runs of letters, digits, "-" and "_" (Claude keys are ~100 long); reject anything else. */
function cleanKey(raw: string | null | undefined): string | null {
  const k = (raw ?? '').trim()
  return /^[A-Za-z0-9_-]{10,200}$/.test(k) ? k : null
}

/** The key inside a setup link, or null. Accepts a whole link or just the "#setup=…" part. */
export function keyFromLink(text: string, kind: KeyKind = 'plantnet'): string | null {
  const hash = text.includes('#') ? text.slice(text.indexOf('#') + 1) : ''
  return cleanKey(new URLSearchParams(hash).get(KINDS[kind].param))
}

export function buildSetupLink(key: string, kind: KeyKind = 'plantnet'): string {
  return `${APP_URL}#${KINDS[kind].param}=${encodeURIComponent(key.trim())}`
}

export type SetupResult = 'saved' | 'same' | 'declined' | 'invalid' | null

/**
 * If the page was opened from a setup link, save its key and remove it from the address bar
 * (so it isn't kept in history, bookmarks or screenshots). Asks before replacing a different key.
 */
export async function applySetupLinkFromUrl(): Promise<SetupResult> {
  const kind = (Object.keys(KINDS) as KeyKind[]).find((k) => location.hash.includes(`${KINDS[k].param}=`))
  if (!kind) return null
  const key = keyFromLink(location.href, kind)
  history.replaceState(history.state, '', location.pathname + location.search)
  if (!key) return 'invalid'
  const { setting, label } = KINDS[kind]
  const current = await getSetting(setting)
  if (current === key) return 'same'
  if (current && !confirm(`This phone already has a different ${label} key. Replace it with the one from this link?`)) return 'declined'
  await setSetting(setting, key)
  return 'saved'
}

/** Open the share sheet with the setup link, or copy it when sharing isn't available. */
export async function shareSetupLink(key: string, kind: KeyKind = 'plantnet'): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const url = buildSetupLink(key, kind)
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
