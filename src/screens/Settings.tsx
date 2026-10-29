import { useEffect, useState } from 'react'
import type { Route } from '../App'
import { getSetting, setSetting } from '../db'
import { dataset } from '../data/ncsu'

export default function Settings(_: { go: (r: Route) => void }) {
  const [key, setKey] = useState('')
  const [hour, setHour] = useState('9')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSetting('plantnetKey').then((k) => k && setKey(k))
    getSetting('reminderHour').then((h) => h && setHour(h))
  }, [])

  async function save() {
    await setSetting('plantnetKey', key.trim())
    await setSetting('reminderHour', hour)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="screen-head"><h1>Settings</h1></div>
      <div className="card">
        <h3>Photo identification</h3>
        <label className="field">
          <span>Pl@ntNet API key</span>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste key" autoCapitalize="off" autoCorrect="off" />
        </label>
        <p className="muted">Free at <a href="https://my.plantnet.org" target="_blank" rel="noreferrer">my.plantnet.org</a> (500 identifications a day). The key stays on this phone.</p>
        <h3>Reminders</h3>
        <label className="field">
          <span>Calendar reminder time</span>
          <select value={hour} onChange={(e) => setHour(e.target.value)}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`}</option>
            ))}
          </select>
        </label>
        <button className="btn primary block" onClick={save}>{saved ? 'Saved' : 'Save settings'}</button>
      </div>

      <div className="card quiet">
        <h3>Where the information comes from</h3>
        <p>Plant care notes are copied word for word from the <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">{dataset.source}</a> ({dataset.plants.length} houseplant profiles, copied {new Date(dataset.fetchedAt).toLocaleDateString()}). Every plant page links to its source.</p>
        <p>Photo identification is by <a href="https://plantnet.org" target="_blank" rel="noreferrer">Pl@ntNet</a>.</p>
        <p>Watering intervals are yours to set; neither source prescribes a schedule.</p>
      </div>

      <div className="card quiet">
        <h3>Install on your phone</h3>
        <p><b>iPhone:</b> in Safari tap Share, then “Add to Home Screen”.</p>
        <p><b>Android:</b> in Chrome open the menu, then “Add to Home screen”.</p>
        <p className="muted">All your plants and photos are stored on this phone only.</p>
      </div>
    </div>
  )
}
