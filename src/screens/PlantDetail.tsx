import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Route } from '../App'
import { db, markWatered, nextDue, getSetting, startOfDay } from '../db'
import { getPlant } from '../data/ncsu'
import { CareInfo } from '../components/CareInfo'
import { PlantThumb } from '../components/PlantThumb'
import { dueLabel } from './Home'
import { wateringEvent, deliverIcs } from '../ics'
import { shrinkImage } from '../plantnet'
import { BackIcon, PencilIcon, CheckIcon, CameraIcon, DropIcon, CalendarIcon } from '../components/Icons'

export default function PlantDetail({ id, go }: { id: number; go: (r: Route) => void }) {
  const plant = useLiveQuery(() => db.plants.get(id), [id])
  const log = useLiveQuery(() => db.waterings.where('plantId').equals(id).reverse().sortBy('at'), [id])
  const [hour, setHour] = useState(9)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [calendarNote, setCalendarNote] = useState<string | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => { getSetting('reminderHour').then((h) => h && setHour(Number(h))) }, [])
  useEffect(() => { if (plant) setName(plant.nickname) }, [plant?.nickname])

  if (plant === undefined) return null // still loading from the database
  if (!plant) return <div className="empty">Plant not found.</div>
  const ncsu = plant.ncsuSlug ? getPlant(plant.ncsuSlug) : undefined
  const label = dueLabel(plant)
  const hourLabel = hour === 0 ? '12 am' : hour < 12 ? `${hour} am` : hour === 12 ? '12 pm' : `${hour - 12} pm`

  async function updateInterval(d: number) {
    await db.plants.update(id, { intervalDays: Math.min(60, Math.max(1, d)) })
  }
  async function saveName() {
    await db.plants.update(id, { nickname: name.trim() || plant!.nickname })
    setEditing(false)
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
        <button className="icon-btn back" onClick={() => go({ name: 'home' })} aria-label="Back to my plants"><BackIcon /></button>
        {editing ? (
          <form className="name-edit" onSubmit={(e) => { e.preventDefault(); saveName() }}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} autoFocus aria-label="Plant name" />
            <button type="submit" className="icon-btn" aria-label="Save name"><CheckIcon /></button>
          </form>
        ) : (
          <>
            <h1>{plant.nickname}</h1>
            <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Rename plant"><PencilIcon /></button>
          </>
        )}
      </div>

      <div className="photo-wrap">
        <PlantThumb photo={plant.photo} big />
        <input ref={photoInput} className="hidden-input" type="file" accept="image/*" capture="environment" onChange={(e) => newPhoto(e.target.files?.[0])} />
        <button type="button" className="photo-chip" onClick={() => photoInput.current?.click()}>
          <CameraIcon /> {plant.photo ? 'Change photo' : 'Add photo'}
        </button>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="muted">Next watering</div>
            <span className={`pill ${label.cls}`}>{label.text}</span>
          </div>
          <button className="btn water" onClick={() => markWatered(id)}><DropIcon /> Watered now</button>
        </div>
        <label className="field">
          <span>Water every</span>
          <div className="stepper">
            <button type="button" aria-label="Fewer days" onClick={() => updateInterval(plant.intervalDays - 1)}>−</button>
            <strong>{plant.intervalDays} day{plant.intervalDays === 1 ? '' : 's'}</strong>
            <button type="button" aria-label="More days" onClick={() => updateInterval(plant.intervalDays + 1)}>+</button>
          </div>
        </label>
        <button className="btn block" onClick={addToCalendar}><CalendarIcon /> Add reminder to Calendar</button>
        {calendarNote && <p className="notice ok mt">{calendarNote}</p>}
        <p className="muted">Creates a repeating “Water {plant.nickname}” event with an alert at {hourLabel}. Add it again after changing the interval; the old one is replaced.</p>
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
      {log && log.length === 0 && <p className="muted">No waterings logged yet. Tap “Watered now” the first time you water it.</p>}
      {log && log.length > 0 && (
        <ul className="log card">
          {log.map((w) => (
            <li key={w.id}>
              <span>{new Date(w.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="muted">{new Date(w.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      )}

      <button className="btn small danger" style={{ marginTop: 24 }} onClick={remove}>Remove plant</button>
    </div>
  )
}
