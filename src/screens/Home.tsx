import { useLiveQuery } from 'dexie-react-hooks'
import { db, daysUntilDue, isDue, markWatered, type Plant } from '../db'
import type { Route } from '../App'
import { PlantThumb } from '../components/PlantThumb'
import { DropIcon, CheckIcon, SproutArt } from '../components/Icons'

export function dueLabel(p: Plant): { text: string; cls: 'ok' | 'soon' | 'due' } {
  const d = daysUntilDue(p)
  if (d === null) return { text: 'Not watered yet', cls: 'due' }
  if (d < 0) return { text: `${-d} day${d === -1 ? '' : 's'} overdue`, cls: 'due' }
  if (d === 0) return { text: 'Water today', cls: 'due' }
  if (d === 1) return { text: 'Tomorrow', cls: 'soon' }
  return { text: `In ${d} days`, cls: 'ok' }
}

/** How much of the watering interval is left, 0–1 (null when never watered). */
function remainingFraction(p: Plant): number | null {
  const d = daysUntilDue(p)
  if (d === null) return null
  return Math.max(0, Math.min(1, d / Math.max(1, p.intervalDays)))
}

export default function Home({ go }: { go: (r: Route) => void }) {
  const plants = useLiveQuery(() => db.plants.toArray(), [])
  if (!plants) return null

  const sorted = [...plants].sort((a, b) => (daysUntilDue(a) ?? -999) - (daysUntilDue(b) ?? -999))
  const due = sorted.filter((p) => isDue(p))
  const later = sorted.filter((p) => !isDue(p))

  if (plants.length === 0) {
    return (
      <div>
        <div className="screen-head"><h1>My plants</h1></div>
        <div className="empty">
          <SproutArt />
          <h2>Nothing growing here yet</h2>
          <p>Add your first plant from a photo, or find it by name.</p>
          <button className="btn primary" onClick={() => go({ name: 'add' })}>Add a plant</button>
        </div>
      </div>
    )
  }

  const Row = ({ p }: { p: Plant }) => {
    const label = dueLabel(p)
    const left = remainingFraction(p)
    return (
      <div className="card plant-card">
        <button className="plant-row" onClick={() => go({ name: 'plant', id: p.id! })}>
          <PlantThumb photo={p.photo} />
          <div className="grow">
            <div className="title">{p.nickname}</div>
            <div className="muted sci">{p.identifiedAs?.scientificName ?? 'Not identified'}</div>
            <div className="status-row">
              <div className={`track ${label.cls}`} aria-hidden="true">
                <i style={{ width: `${Math.round((left ?? 0) * 100)}%` }} />
              </div>
              <span className={`pill ${label.cls}`}>{label.text}</span>
            </div>
          </div>
        </button>
        {label.cls === 'due' && (
          <button className="btn small water watered-btn" onClick={() => markWatered(p.id!)}>
            <DropIcon /> Watered just now
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="screen-head"><h1>My plants</h1></div>
      {due.length === 0 ? (
        <div className="status-line">
          <CheckIcon />
          <div><strong>All watered</strong><span>Nothing to do today.</span></div>
        </div>
      ) : (
        <div className="status-line needs">
          <DropIcon />
          <div>
            <strong>{due.length === 1 ? '1 plant needs water' : `${due.length} plants need water`}</strong>
            <span>Tap a plant to see its care notes.</span>
          </div>
        </div>
      )}
      {due.length > 0 && <h2>Water today</h2>}
      {due.map((p) => <Row key={p.id} p={p} />)}
      {later.length > 0 && <h2>Coming up</h2>}
      {later.map((p) => <Row key={p.id} p={p} />)}
    </div>
  )
}
