import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Route } from '../App'
import { db, getSetting, setSetting, clearSamplePlants } from '../db'
import { useWinter } from '../hooks'
import { dataset } from '../data/ncsu'
import { loadSamplePlants } from '../samples'
import { formatHour } from '../format'
import { keyFromLink, shareSetupLink } from '../setup'

const WINTER_OPTIONS = [25, 50, 100]

export default function Settings(_: { go: (r: Route) => void }) {
  const [key, setKey] = useState('')
  const [claudeKey, setClaudeKey] = useState('')
  const [hour, setHour] = useState('9')
  const [saved, setSaved] = useState(false)
  const [loadingSamples, setLoadingSamples] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const winter = useWinter()
  const sampleCount = useLiveQuery(() => db.plants.filter((p) => !!p.isSample).count(), [])
  const savedKey = useLiveQuery(() => getSetting('plantnetKey').then((k) => k ?? ''), [])
  const savedClaudeKey = useLiveQuery(() => getSetting('anthropicKey').then((k) => k ?? ''), [])

  /** The key field also accepts a whole setup link (the fallback if the link didn't carry over). */
  function onKeyInput(text: string) {
    setKey(keyFromLink(text) ?? text)
  }

  async function share(kind: 'claude' | 'plantnet') {
    const k = kind === 'claude' ? savedClaudeKey : savedKey
    if (!k) return
    const r = await shareSetupLink(k, kind)
    setShareNote(r === 'copied' ? 'Link copied. Paste it into a message to her.'
      : r === 'failed' ? 'Could not share or copy the link on this device.'
      : null)
  }

  async function addSamples() {
    setLoadingSamples(true)
    try { await loadSamplePlants() } finally { setLoadingSamples(false) }
  }

  useEffect(() => {
    getSetting('plantnetKey').then((k) => k && setKey(k))
    getSetting('anthropicKey').then((k) => k && setClaudeKey(k))
    getSetting('reminderHour').then((h) => h && setHour(h))
  }, [])

  async function save() {
    await setSetting('plantnetKey', key.trim())
    await setSetting('anthropicKey', claudeKey.trim())
    await setSetting('reminderHour', hour)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="screen-head"><h1>Settings</h1></div>

      <div className="card">
        <h3>Try it out</h3>
        <p className="muted" style={{ marginTop: 0 }}>Three made-up plants with invented dates, notes and photos, each marked “Test”. Removing them never touches your own plants.</p>
        <div className="row">
          <button className="btn" onClick={addSamples} disabled={loadingSamples}>{loadingSamples ? 'Adding…' : sampleCount ? 'Reset test plants' : 'Add 3 test plants'}</button>
          {!!sampleCount && <button className="btn danger" onClick={clearSamplePlants}>Remove test plants</button>}
        </div>
      </div>

      <div className="card">
        <h3>Winter mode</h3>
        <label className="switch-row">
          <span>
            <strong>Water less often</strong>
            <small>Every watering interval gets longer while this is on.</small>
          </span>
          <input type="checkbox" role="switch" checked={winter.on} onChange={(e) => setSetting('winterMode', e.target.checked ? '1' : '0')} />
          <i aria-hidden="true" />
        </label>
        {winter.on && (
          <div className="field">
            <span>How much longer</span>
            <div className="chips" role="radiogroup" aria-label="How much longer">
              {WINTER_OPTIONS.map((pct) => (
                <button key={pct} type="button" role="radio" aria-checked={winter.extra === pct}
                  className={`chip ${winter.extra === pct ? 'on' : ''}`} onClick={() => setSetting('winterExtra', String(pct))}>
                  +{pct}%
                </button>
              ))}
            </div>
            <p className="muted">So every 7 days becomes every {Math.round(7 * (1 + winter.extra / 100))} days.</p>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Photo identification</h3>
        <label className="field">
          <span>Claude API key</span>
          <input type="password" value={claudeKey} onChange={(e) => setClaudeKey(keyFromLink(e.target.value, 'claude') ?? e.target.value)} placeholder="Paste the key or a setup link" autoCapitalize="off" autoCorrect="off" />
        </label>
        <p className="muted">Create one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>. Each photo costs a small amount, so set a monthly spend limit there. The key stays on this phone.</p>
        {savedClaudeKey && (
          <>
            <button type="button" className="btn block" onClick={() => share('claude')}>Share setup link</button>
            <p className="muted">Sends a link that sets up photo identification on another phone in one tap. Anyone with the link can use your Claude credit, so share it only with people you trust.</p>
          </>
        )}
        <label className="field">
          <span>Pl@ntNet API key (optional)</span>
          <input type="password" value={key} onChange={(e) => onKeyInput(e.target.value)} placeholder="Paste the key or a setup link" autoCapitalize="off" autoCorrect="off" />
        </label>
        <p className="muted">Free at <a href="https://my.plantnet.org" target="_blank" rel="noreferrer">my.plantnet.org</a> (500 identifications a day). Used only when there is no Claude key.</p>
        {savedKey && (
          <>
            <button type="button" className="btn block" onClick={() => share('plantnet')}>Share Pl@ntNet setup link</button>
          </>
        )}
        {shareNote && <p className="notice ok mt">{shareNote}</p>}
        <h3>Reminders</h3>
        <label className="field">
          <span>Calendar reminder time</span>
          <select value={hour} onChange={(e) => setHour(e.target.value)}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
        </label>
        <button className="btn primary block" onClick={save}>{saved ? 'Saved' : 'Save settings'}</button>
      </div>

      <div className="card quiet">
        <h3>Where the information comes from</h3>
        <p>Plant care notes are copied word for word from the <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">{dataset.source}</a> ({dataset.plants.length} houseplant profiles, copied {new Date(dataset.fetchedAt).toLocaleDateString()}). Every plant page links to its source.</p>
        <p>Photo identification is by <a href="https://www.anthropic.com/claude" target="_blank" rel="noreferrer">Claude</a> or, if you add a key, <a href="https://plantnet.org" target="_blank" rel="noreferrer">Pl@ntNet</a>.</p>
        <p>Watering intervals and winter mode are yours to set; neither source prescribes a schedule.</p>
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
