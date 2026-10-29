import { useLiveQuery } from 'dexie-react-hooks'
import { db, daysUntilDue, markWatered, type Plant } from '../db'
import type { Route } from '../App'
import { PlantThumb } from '../components/PlantThumb'

export function dueLabel(p: Plant): { text: string; cls: 'ok' | 'soon' | 'due' } {
  const d = daysUntilDue(p)
  if (d === null) return { text: 'Not watered yet', cls: 'soon' }
  if (d < 0) return { text: `${-d} day${d === -1 ? '' : 's'} overdue`, cls: 'due' }
  if (d === 0) return { text: 'Water today', cls: 'due' }
  if (d === 1) return { text: 'Tomorrow', cls: 'soon' }
  return { text: `In ${d} days`, cls: 'ok' }
}

export default function Home({ go }: { go: (r: Route) => void }) {
  const plants = useLiveQuery(() => db.plants.toArray(), [])
  if (!plants) return null

  const sorted = [...plants].sort((a, b) => (daysUntilDue(a) ?? -999) - (daysUntilDue(b) ?? -999))
  const due = sorted.filter((p) => (daysUntilDue(p) ?? 0) <= 0)
  const later = sorted.filter((p) => (daysUntilDue(p) ?? 0) > 0)

  if (plants.length === 0) {
    return (
      <div>
        <h1>My plants</h1>
        <div className="empty">
          <div className="big">🪴</div>
          <p>No plants yet. Tap <b>Scan</b> to photograph your first one.</p>
          <button className="btn primary" onClick={() => go({ name: 'add' })}>Add a plant</button>
        </div>
      </div>
    )
  }

  const Row = ({ p }: { p: Plant }) => {
    const label = dueLabel(p)
    return (
      <div className="card">
        <button className="plant-row" onClick={() => go({ name: 'plant', id: p.id! })}>
          <PlantThumb photo={p.photo} />
          <div className="grow">
            <div className="title">{p.nickname}</div>
            <div className="muted">{p.identifiedAs?.scientificName ?? 'Unidentified'}</div>
          </div>
          <span className={`pill ${label.cls}`}>{label.text}</span>
        </button>
        {label.cls === 'due' && (
          <button className="btn small block" style={{ marginTop: 10 }} onClick={() => markWatered(p.id!)}>
            💧 Watered just now
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <h1>My plants</h1>
      <p className="muted">{due.length === 0 ? 'Nothing to water today.' : `${due.length} to water today.`}</p>
      {due.length > 0 && <h2>Water today</h2>}
      {due.map((p) => <Row key={p.id} p={p} />)}
      {later.length > 0 && <h2>Coming up</h2>}
      {later.map((p) => <Row key={p.id} p={p} />)}
    </div>
  )
}
