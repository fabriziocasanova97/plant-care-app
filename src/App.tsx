import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, isDue } from './db'
import Home from './screens/Home'
import AddPlant from './screens/AddPlant'
import PlantDetail from './screens/PlantDetail'
import Settings from './screens/Settings'
import { LeafIcon, CameraIcon, GearIcon } from './components/Icons'
import { useWinter } from './hooks'

export type Route = { name: 'home' } | { name: 'add' } | { name: 'plant'; id: number } | { name: 'settings' }

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const plants = useLiveQuery(() => db.plants.toArray(), [])
  const winter = useWinter()

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
      setRoute((e.state as Route | null) ?? { name: 'home' })
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Drilling into a plant adds a history entry (back returns to the list); switching
  // top-level tabs replaces it, so back never has to walk through every tab tap.
  const go = (r: Route) => {
    if (r.name === 'plant') history.pushState(r, '')
    else history.replaceState(r, '')
    setRoute(r)
    window.scrollTo(0, 0)
  }

  return (
    <div className="app">
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
