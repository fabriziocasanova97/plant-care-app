import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, isDue } from './db'
import Home from './screens/Home'
import AddPlant from './screens/AddPlant'
import PlantDetail from './screens/PlantDetail'
import Settings from './screens/Settings'

export type Route = { name: 'home' } | { name: 'add' } | { name: 'plant'; id: number } | { name: 'settings' }

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const plants = useLiveQuery(() => db.plants.toArray(), [])

  // App icon badge = number of plants due today or overdue (where the browser supports it).
  useEffect(() => {
    if (!plants || !('setAppBadge' in navigator)) return
    const due = plants.filter((p) => isDue(p)).length
    const nav = navigator as Navigator & { setAppBadge(n?: number): Promise<void>; clearAppBadge(): Promise<void> }
    ;(due > 0 ? nav.setAppBadge(due) : nav.clearAppBadge()).catch(() => {})
  }, [plants])

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

  const go = (r: Route) => {
    history.pushState(r, '')
    setRoute(r)
    window.scrollTo(0, 0)
  }

  return (
    <div className="app">
      {route.name === 'home' && <Home go={go} />}
      {route.name === 'add' && <AddPlant go={go} />}
      {route.name === 'plant' && <PlantDetail id={route.id} go={go} />}
      {route.name === 'settings' && <Settings go={go} />}
      <nav className="tabbar">
        <button className={route.name === 'home' ? 'active' : ''} onClick={() => go({ name: 'home' })}>
          <span>🪴</span>My plants
        </button>
        <button className={route.name === 'add' ? 'active' : ''} onClick={() => go({ name: 'add' })}>
          <span>📷</span>Scan
        </button>
        <button className={route.name === 'settings' ? 'active' : ''} onClick={() => go({ name: 'settings' })}>
          <span>⚙️</span>Settings
        </button>
      </nav>
    </div>
  )
}
