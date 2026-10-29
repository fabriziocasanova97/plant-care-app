import { useLiveQuery } from 'dexie-react-hooks'
import { db, daysUntilDue, isDue, markWatered, effectiveInterval, seasonKey, setSetting, clearSamplePlants, WINTER_MONTHS, type Plant } from '../db'
import { useWinter } from '../hooks'
import type { Route } from '../App'
import { PlantThumb } from '../components/PlantThumb'
import { DropIcon, CheckIcon, SproutArt, SnowIcon, FlagIcon, CloseIcon } from '../components/Icons'

export function dueLabel(p: Plant, winterFactor = 0): { text: string; cls: 'ok' | 'soon' | 'due' } {
  const d = daysUntilDue(p, winterFactor)
  if (d === null) return { text: 'Not watered yet', cls: 'due' }
  if (d < 0) return { text: `${-d} day${d === -1 ? '' : 's'} overdue`, cls: 'due' }
  if (d === 0) return { text: 'Water today', cls: 'due' }
  if (d === 1) return { text: 'Tomorrow', cls: 'soon' }
  return { text: `In ${d} days`, cls: 'ok' }
}

/** How much of the watering interval is left, 0–1 (null when never watered). */
function remainingFraction(p: Plant, winterFactor: number): number | null {
  const d = daysUntilDue(p, winterFactor)
  if (d === null) return null
  return Math.max(0, Math.min(1, d / effectiveInterval(p, winterFactor)))
}

/** A once-per-season nudge: turn winter mode on in Nov–Feb, off in the growing season. */
function WinterNudge() {
  const winter = useWinter()
  const season = seasonKey()
  // '' = never dismissed; undefined = still loading (a missing row must not read as "loading" forever).
  const dismissed = useLiveQuery(() => db.settings.get('winterNudge').then((r) => r?.value ?? ''), [])
  if (dismissed === undefined || dismissed === season) return null
  const isWinter = WINTER_MONTHS.has(new Date().getMonth())
  if (isWinter === winter.on) return null
  const dismiss = () => setSetting('winterNudge', season)
  // The button does the thing right here; Settings is still where she can fine-tune it.
  const toggle = async () => { await setSetting('winterMode', isWinter ? '1' : '0'); dismiss() }
  return (
    <div className="nudge">
      <SnowIcon />
      <div className="grow">
        {isWinter
          ? <><strong>Winter is here.</strong> Winter mode stretches every watering interval.</>
          : <><strong>Days are longer again.</strong> Winter mode is still on.</>}
      </div>
      <button className="btn small" onClick={toggle}>{isWinter ? 'Turn on' : 'Turn off'}</button>
      <button className="icon-btn" onClick={dismiss} aria-label="Not now"><CloseIcon /></button>
    </div>
  )
}

/** One plant in the list. Module-level so rows keep their identity (and photo URLs) across re-renders. */
function Row({ p, f, go }: { p: Plant; f: number; go: (r: Route) => void }) {
  const label = dueLabel(p, f)
  const left = remainingFraction(p, f)
  return (
    <div className="card plant-card">
      <button className="plant-row" onClick={() => go({ name: 'plant', id: p.id! })}>
        <PlantThumb photo={p.photo} />
        <div className="grow">
          <div className="title">
            {p.attention && <FlagIcon className="flag" aria-label="Flagged" />}
            {p.nickname}
            {p.isSample && <span className="tag test">Test</span>}
          </div>
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

export default function Home({ go }: { go: (r: Route) => void }) {
  const plants = useLiveQuery(() => db.plants.toArray(), [])
  const winter = useWinter()
  if (!plants || !winter.loaded) return null
  const f = winter.factor

  const sorted = [...plants].sort((a, b) => (daysUntilDue(a, f) ?? -999) - (daysUntilDue(b, f) ?? -999))
  const due = sorted.filter((p) => isDue(p, f))
  const later = sorted.filter((p) => !isDue(p, f))

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

  return (
    <div>
      <div className="screen-head">
        <h1>My plants</h1>
        {winter.on && <span className="pill winter" title="Winter mode is on"><SnowIcon /> Winter</span>}
      </div>
      <WinterNudge />
      {plants.some((p) => p.isSample) && (
        <div className="nudge test">
          <div className="grow"><strong>Test plants are loaded.</strong> Look around, then remove them in one tap.</div>
          <button className="btn small" onClick={clearSamplePlants}>Remove test plants</button>
        </div>
      )}
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
      {due.map((p) => <Row key={p.id} p={p} f={f} go={go} />)}
      {later.length > 0 && <h2>Coming up</h2>}
      {later.map((p) => <Row key={p.id} p={p} f={f} go={go} />)}
    </div>
  )
}
