import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Route } from '../App'
import { db, markWatered, nextDue, getSetting, startOfDay, effectiveInterval, daysSince, addPhoto, deletePhoto, removePlant, type Photo } from '../db'
import { useWinter } from '../hooks'
import { getPlant } from '../data/ncsu'
import { CareInfo } from '../components/CareInfo'
import { PlantThumb } from '../components/PlantThumb'
import { dueLabel } from './Home'
import { wateringEvent, deliverIcs } from '../ics'
import { shrinkImage } from '../plantnet'
import { BackIcon, PencilIcon, CheckIcon, CameraIcon, DropIcon, CalendarIcon, FlagIcon, CloseIcon, TrashIcon, SnowIcon } from '../components/Icons'

const dateLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

function agoLabel(t: number): string {
  const d = daysSince(t)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

/** One photo in the timeline; keeps its object URL alive only while mounted. */
function PhotoTile({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo.blob])
  return (
    <button className="photo-tile" onClick={onOpen} aria-label={`Photo from ${dateLabel(photo.at)}`}>
      {url && <img src={url} alt="" />}
      <span>{new Date(photo.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
    </button>
  )
}

/** Full-screen photo. Closes on the X, on Escape, or on a tap outside the picture. */
function PhotoViewer({ photo, onClose, onDelete }: { photo: Photo; onClose: () => void; onDelete: () => void }) {
  const [url, setUrl] = useState<string>()
  const closeBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo.blob])
  useEffect(() => { closeBtn.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="viewer" role="dialog" aria-label="Photo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="viewer-bar">
        <span><strong>{dateLabel(photo.at)}</strong><small>{agoLabel(photo.at)}</small></span>
        <button ref={closeBtn} className="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
      </div>
      {url && <img src={url} alt="" />}
      <button className="btn small danger" onClick={onDelete}><TrashIcon /> Delete photo</button>
    </div>
  )
}

export default function PlantDetail({ id, go }: { id: number; go: (r: Route) => void }) {
  const plant = useLiveQuery(() => db.plants.get(id), [id])
  const log = useLiveQuery(() => db.waterings.where('plantId').equals(id).reverse().sortBy('at'), [id])
  const photos = useLiveQuery(() => db.photos.where('plantId').equals(id).reverse().sortBy('at'), [id])
  const winter = useWinter()
  const [hour, setHour] = useState(9)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [calendarNote, setCalendarNote] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Photo | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => { getSetting('reminderHour').then((h) => h && setHour(Number(h))) }, [])
  useEffect(() => { if (plant) setName(plant.nickname) }, [plant?.nickname])

  if (plant === undefined || !winter.loaded) return null // still loading from the database
  if (!plant) return <div className="empty">Plant not found.</div>
  const ncsu = plant.ncsuSlug ? getPlant(plant.ncsuSlug) : undefined
  const f = winter.factor
  const label = dueLabel(plant, f)
  const every = effectiveInterval(plant, f)
  const hourLabel = hour === 0 ? '12 am' : hour < 12 ? `${hour} am` : hour === 12 ? '12 pm' : `${hour - 12} pm`

  async function updateInterval(d: number) {
    await db.plants.update(id, { intervalDays: Math.min(60, Math.max(1, d)) })
  }
  async function saveName() {
    await db.plants.update(id, { nickname: name.trim() || plant!.nickname })
    setEditing(false)
  }
  async function saveNote() {
    if (note !== null) await db.plants.update(id, { note: note.trim() })
  }
  async function remove() {
    if (!confirm(`Remove ${plant!.nickname}?`)) return
    await removePlant(id)
    go({ name: 'home' })
  }
  async function addToCalendar() {
    const first = nextDue(plant!, f) ?? startOfDay(Date.now())
    const body = wateringEvent({ ...plant!, intervalDays: every }, Math.max(first, startOfDay(Date.now())), hour)
    const how = await deliverIcs(`water-${plant!.nickname.replace(/\W+/g, '-').toLowerCase()}.ics`, body)
    setCalendarNote(how === 'shared'
      ? 'In the share sheet, choose Calendar (or “Add to Calendar”).'
      : 'Open the downloaded .ics file to add it to your calendar.')
  }
  async function newPhoto(file: File | undefined) {
    if (!file) return
    await addPhoto(id, await shrinkImage(file))
  }
  async function removePhoto(p: Photo) {
    if (!confirm('Delete this photo?')) return
    await deletePhoto(p.id!)
    setViewing(null)
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
            <h1>{plant.nickname}{plant.isSample && <span className="tag test">Test</span>}</h1>
            <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Rename plant"><PencilIcon /></button>
          </>
        )}
      </div>

      <div className="photo-wrap">
        {photos && photos.length > 0 ? (
          <button type="button" className="photo-open" onClick={() => setViewing(photos[0])} aria-label="View photo full screen">
            <PlantThumb photo={plant.photo} big />
          </button>
        ) : (
          <PlantThumb photo={plant.photo} big />
        )}
        <input ref={photoInput} className="hidden-input" type="file" accept="image/*" capture="environment" onChange={(e) => { newPhoto(e.target.files?.[0]); e.target.value = '' }} />
        <button type="button" className="photo-chip" onClick={() => photoInput.current?.click()}>
          <CameraIcon /> {plant.photo ? 'New photo' : 'Add photo'}
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
        {plant.lastWateredAt !== null && <p className="muted mt">Last watered {agoLabel(plant.lastWateredAt)}.</p>}
        <label className="field">
          <span>Water every</span>
          <div className="stepper">
            <button type="button" aria-label="Fewer days" onClick={() => updateInterval(plant.intervalDays - 1)}>−</button>
            <strong>{plant.intervalDays} day{plant.intervalDays === 1 ? '' : 's'}</strong>
            <button type="button" aria-label="More days" onClick={() => updateInterval(plant.intervalDays + 1)}>+</button>
          </div>
        </label>
        {winter.on && every !== plant.intervalDays && (
          <p className="muted winter-note"><SnowIcon /> Every {every} days while winter mode is on.</p>
        )}
        <button className="btn block mt" onClick={addToCalendar}><CalendarIcon /> Add reminder to Calendar</button>
        {calendarNote && <p className="notice ok mt">{calendarNote}</p>}
        <p className="muted">Repeats every {every} days with an alert at {hourLabel}. If you change the interval, add it again.</p>
      </div>

      <div className="card">
        <label className="switch-row">
          <span>
            <strong><FlagIcon className="inline" /> Keep an eye on it</strong>
            <small>Adds a little flag by its name on My plants.</small>
          </span>
          <input type="checkbox" role="switch" checked={!!plant.attention} onChange={(e) => db.plants.update(id, { attention: e.target.checked })} />
          <i aria-hidden="true" />
        </label>
        <label className="field">
          <span>My notes</span>
          <textarea rows={2} placeholder="Where it lives, what you’ve noticed…" value={note ?? plant.note ?? ''}
            onChange={(e) => setNote(e.target.value)} onBlur={saveNote} />
        </label>
      </div>

      {photos && photos.length > 1 && (
        <>
          <h2>Photos</h2>
          <div className="photo-strip">
            {photos.map((p) => <PhotoTile key={p.id} photo={p} onOpen={() => setViewing(p)} />)}
          </div>
        </>
      )}

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

      {viewing && <PhotoViewer photo={viewing} onClose={() => setViewing(null)} onDelete={() => removePhoto(viewing)} />}
    </div>
  )
}
