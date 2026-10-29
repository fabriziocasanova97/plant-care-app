import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Route } from '../App'
import { db, markWatered, nextDue, getSetting, startOfDay } from '../db'
import { getPlant } from '../data/ncsu'
import { CareInfo } from '../components/CareInfo'
import { PlantThumb } from '../components/PlantThumb'
import { dueLabel } from './Home'
import { wateringEvent, deliverIcs } from '../ics'
import { shrinkImage } from '../plantnet'

export default function PlantDetail({ id, go }: { id: number; go: (r: Route) => void }) {
  const plant = useLiveQuery(() => db.plants.get(id), [id])
  const log = useLiveQuery(() => db.waterings.where('plantId').equals(id).reverse().sortBy('at'), [id])
  const [hour, setHour] = useState(9)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [calendarNote, setCalendarNote] = useState<string | null>(null)

  useEffect(() => { getSetting('reminderHour').then((h) => h && setHour(Number(h))) }, [])
  useEffect(() => { if (plant) setName(plant.nickname) }, [plant?.nickname])

  if (!plant) return <div className="empty">Plant not found.</div>
  const ncsu = plant.ncsuSlug ? getPlant(plant.ncsuSlug) : undefined
  const label = dueLabel(plant)

  async function updateInterval(d: number) {
    await db.plants.update(id, { intervalDays: Math.min(60, Math.max(1, d)) })
  }
  async function remove() {
    if (!confirm(`Remove ${plant!.nickname}?`)) return
    await db.transaction('rw', db.plants, db.waterings, async () => {
      await db.waterings.where('plantId').equals(id).delete()
      await db.plants.delete(id)
    })
    go({ name: 'home' })
  }
  async function addToCalendar() {
    const first = nextDue(plant!) ?? startOfDay(Date.now())
    const body = wateringEvent(plant!, Math.max(first, startOfDay(Date.now())), hour)
    const how = await deliverIcs(`water-${plant!.nickname.replace(/\W+/g, '-').toLowerCase()}.ics`, body)
    setCalendarNote(how === 'shared'
      ? 'In the share sheet, choose Calendar (or “Add to Calendar”).'
      : 'Open the downloaded .ics file to add it to your calendar.')
  }
  async function newPhoto(file: File | undefined) {
    if (!file) return
    await db.plants.update(id, { photo: await shrinkImage(file) })
  }

  return (
    <div>
      <div className="screen-head">
        <button className="back" onClick={() => go({ name: 'home' })} aria-label="Back">‹</button>
        {editing ? (
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            onBlur={async () => { await db.plants.update(id, { nickname: name.trim() || plant.nickname }); setEditing(false) }} autoFocus />
        ) : (
          <h1 onClick={() => setEditing(true)}>{plant.nickname}</h1>
        )}
      </div>
      <label>
        <PlantThumb photo={plant.photo} big />
        <input className="hidden-input" type="file" accept="image/*" capture="environment" onChange={(e) => newPhoto(e.target.files?.[0])} />
        <div className="muted" style={{ textAlign: 'center', marginTop: 6 }}>Tap photo to replace</div>
      </label>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="muted">Next watering</div>
            <span className={`pill ${label.cls}`}>{label.text}</span>
          </div>
          <button className="btn primary" onClick={() => markWatered(id)}>💧 Watered now</button>
        </div>
        <label className="field">
          <span>Water every</span>
          <div className="stepper">
            <button onClick={() => updateInterval(plant.intervalDays - 1)}>−</button>
            <strong>{plant.intervalDays} day{plant.intervalDays === 1 ? '' : 's'}</strong>
            <button onClick={() => updateInterval(plant.intervalDays + 1)}>+</button>
          </div>
        </label>
        <button className="btn block" onClick={addToCalendar}>📅 Add reminder to Calendar</button>
        {calendarNote && <p className="notice ok">{calendarNote}</p>}
        <p className="muted">Creates a repeating “Water {plant.nickname}” event with an alert at {hour}:00. Add it again after changing the interval; the old one is replaced.</p>
      </div>

      {ncsu ? (
        <CareInfo plant={ncsu} />
      ) : (
        <p className="notice">
          No NC State Extension profile is linked to this plant, so there are no care notes to show.
          {plant.identifiedAs && <> Identified by Pl@ntNet as <i>{plant.identifiedAs.scientificName}</i>.</>}
        </p>
      )}

      <h2>Watering log</h2>
      {log && log.length === 0 && <p className="muted">No waterings logged yet.</p>}
      <ul className="log">
        {log?.map((w) => (
          <li key={w.id}>
            <span>{new Date(w.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span className="muted">{new Date(w.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
          </li>
        ))}
      </ul>

      <button className="btn small" style={{ marginTop: 24, color: 'var(--red)' }} onClick={remove}>Remove plant</button>
    </div>
  )
}
