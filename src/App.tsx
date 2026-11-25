import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, isDue } from './db'
import Home from './screens/Home'
import AddPlant from './screens/AddPlant'
import PlantDetail from './screens/PlantDetail'
import Settings from './screens/Settings'
import { LeafIcon, CameraIcon, GearIcon } from './components/Icons'
import { useWinter } from './hooks'
import { applySetupLinkFromUrl, type SetupResult } from './setup'
import { showToast, useToast, type Toast } from './toast'

const SETUP_MESSAGES: Record<Exclude<SetupResult, null | 'declined'>, Toast> = {
  saved: { text: 'Photo identification is ready. Tap Scan to try it.', cls: 'ok' },
  same: { text: 'Photo identification was already set up on this phone.', cls: 'ok' },
  invalid: { text: 'That setup link looks incomplete. Ask for a new one, or paste the key in Settings.', cls: 'err' },
}

export type Route = { name: 'home' } | { name: 'add' } | { name: 'plant'; id: number } | { name: 'settings' }

/** True on the entry pushed above My plants (a plant page, or a tab opened from one). */
export const isTopEntry = () => !!(history.state as { top?: boolean } | null)?.top

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const toast = useToast()
  const plants = useLiveQuery(() => db.plants.toArray(), [])
  const winter = useWinter()

  // Opened from a setup link (or one was opened while the app was already showing)?
  // Save the key, clean the address bar, and say so.
  useEffect(() => {
    const check = () => applySetupLinkFromUrl().then((r) => {
      if (r && r !== 'declined') showToast(SETUP_MESSAGES[r], 6000)
    })
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])

  // Ask the browser to keep this app's data (plants, photos, log) even when the phone is low
  // on space. Browsers may say no; nothing else depends on the answer.
  useEffect(() => {
    navigator.storage?.persisted?.().then((done) => { if (!done) navigator.storage.persist?.() }).catch(() => {})
  }, [])

  // App icon badge = number of plants due today or overdue (where the browser supports it).
  useEffect(() => {
    if (!plants || !('setAppBadge' in navigator)) return
    const due = plants.filter((p) => isDue(p, winter.factor)).length
    const nav = navigator as Navigator & { setAppBadge(n?: number): Promise<void>; clearAppBadge(): Promise<void> }
    ;(due > 0 ? nav.setAppBadge(due) : nav.clearAppBadge()).catch(() => {})
  }, [plants, winter.factor])

  // Mirror the route into browser history so the Android back button (and swipe-back) navigates
  // inside the app instead of closing it.
  useEffect(() => {
    history.replaceState({ name: 'home' }, '')
    const onPop = (e: PopStateEvent) => {
      // A setup link opened while the app is showing is not a navigation; stay on this screen.
      if (location.hash.includes('setup=')) return
      setRoute((e.state as Route | null) ?? { name: 'home' })
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // History holds at most two entries: the list, and a plant page on top of it. So back from
  // a plant always returns to My plants (even right after adding it from Scan), and back
  // from a tab leaves the app instead of walking through every tab tap.
  const go = (r: Route) => {
    const onTop = isTopEntry()
    if (r.name === 'home' && onTop) {
      history.back() // drop the top entry instead of stacking a second "home"
    } else if (r.name === 'plant' && !onTop) {
      history.replaceState({ name: 'home' }, '')
      history.pushState({ ...r, top: true }, '')
    } else {
      history.replaceState(onTop ? { ...r, top: true } : r, '')
    }
    setRoute(r)
    window.scrollTo(0, 0)
  }

  return (
    <div className="app">
      {toast && (
        <div className={`toast notice ${toast.cls ?? 'ok'}`} role="status" onClick={() => !toast.action && showToast(null)}>
          <span className="grow">{toast.text}</span>
          {toast.action && <button type="button" className="toast-action" onClick={toast.action.run}>{toast.action.label}</button>}
        </div>
      )}
      {route.name === 'home' && <Home go={go} />}
      {route.name === 'add' && <AddPlant go={go} />}
      {route.name === 'plant' && <PlantDetail id={route.id} go={go} />}
      {route.name === 'settings' && <Settings go={go} />}
      <nav className="tabbar" aria-label="Main">
        <button className={route.name === 'home' || route.name === 'plant' ? 'active' : ''} aria-current={route.name === 'home' ? 'page' : undefined} onClick={() => go({ name: 'home' })}>
          <LeafIcon />My plants
        </button>
        <button className={route.name === 'add' ? 'active' : ''} aria-current={route.name === 'add' ? 'page' : undefined} onClick={() => go({ name: 'add' })}>
          <CameraIcon />Scan
        </button>
        <button className={route.name === 'settings' ? 'active' : ''} aria-current={route.name === 'settings' ? 'page' : undefined} onClick={() => go({ name: 'settings' })}>
          <GearIcon />Settings
        </button>
      </nav>
    </div>
  )
}
