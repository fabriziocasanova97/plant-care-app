import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Route } from '../App'
import { db, getSetting, setSetting, clearSamplePlants } from '../db'
import { useWinter } from '../hooks'
import { dataset } from '../data/ncsu'
import { loadSamplePlants } from '../samples'
import { formatHour } from '../format'
import { keyFromLink, shareSetupLink } from '../setup'
import { showToast } from '../toast'
import { testIdentification, BUILT_IN_KEY } from '../plantnet'

const WINTER_OPTIONS = [25, 50, 100]

export default function Settings(_: { go: (r: Route) => void }) {
  const [key, setKey] = useState('')
  /** True once she types in the key field; until then the field mirrors the saved key. */
  const [keyEdited, setKeyEdited] = useState(false)
  const [hour, setHour] = useState('9')
  const [saved, setSaved] = useState(false)
  const [loadingSamples, setLoadingSamples] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const winter = useWinter()
  const sampleCount = useLiveQuery(() => db.plants.filter((p) => !!p.isSample).count(), [])
  const savedKey = useLiveQuery(() => getSetting('plantnetKey').then((k) => k ?? ''), [])

  // Keep the field in step with the saved key (it can arrive later, e.g. from a setup link).
  // Runs only when the saved key changes, so finishing an edit doesn't flash the old value.
  useEffect(() => { if (!keyEdited && savedKey !== undefined) setKey(savedKey) }, [savedKey])

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)
  /** With a built-in key the field is hidden until she asks for it ("Use a different key"). */
  const [showKeyField, setShowKeyField] = useState(false)

  /** Drop the key saved on this phone and go back to the one built into the app. */
  async function switchToBuiltInKey() {
    await setSetting('plantnetKey', '')
    setKey('')
    setKeyEdited(false)
    setShowKeyField(false)
    setTestResult(null)
  }

  /** Send NC State's test photo to Pl@ntNet with the saved key and say plainly whether it worked. */
  async function testKey() {
    if (keyEdited) await save()
    // An empty field means "no key of my own": fall back to the one built into the app.
    const k = (keyEdited ? key.trim() : savedKey) || BUILT_IN_KEY
    if (!k) { setTestResult({ ok: false, text: 'There is no key yet. Paste one above first.' }); return }
    setTesting(true)
    setTestResult(null)
    try {
      const { top, remaining, switched } = await testIdentification(k)
      const name = top.commonNames[0] ? `${top.commonNames[0]} (${top.scientificName})` : top.scientificName
      if (switched) setShowKeyField(false)
      setTestResult({
        ok: true,
        text: (switched ? 'Pl@ntNet did not accept the key saved on this phone, so it was removed and the app now uses its built-in key. ' : '')
          + `It works. Pl@ntNet identified the test photo as ${name}, ${Math.round(top.score * 100)}% sure.`
          + (remaining !== null ? ` ${remaining} identifications left today.` : ''),
      })
    } catch (e) {
      setTestResult({ ok: false, text: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  /** The key field also accepts a whole setup link (the fallback if the link didn't carry over): saved right away. */
  async function onKeyInput(text: string) {
    const fromLink = keyFromLink(text)
    if (fromLink) {
      await setSetting('plantnetKey', fromLink)
      setKey(fromLink)
      setKeyEdited(false)
      showToast({ text: 'Photo identification is ready. Tap Scan to try it.', cls: 'ok' })
      return
    }
    setKey(text)
    setKeyEdited(true)
  }

  async function share() {
    if (!savedKey) return
    const r = await shareSetupLink(savedKey)
    setShareNote(r === 'copied' ? 'Link copied. Paste it into a message to her.'
      : r === 'failed' ? 'Could not share or copy the link on this device.'
      : null)
  }

  async function addSamples() {
    setLoadingSamples(true)
    try { await loadSamplePlants() } finally { setLoadingSamples(false) }
  }

  useEffect(() => {
    getSetting('reminderHour').then((h) => h && setHour(h))
  }, [])

  async function save() {
    // Only write the key she actually edited, so saving the reminder time can never wipe it.
    if (keyEdited) {
      await setSetting('plantnetKey', key.trim())
      setKeyEdited(false)
    }
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
        {savedKey === undefined ? null /* still loading: show neither, so nothing flashes */ : BUILT_IN_KEY && !savedKey && !showKeyField ? (
          <>
            <p className="notice ok">Photo identification is built into the app. Nothing to set up.</p>
            <button type="button" className="btn small link" onClick={() => setShowKeyField(true)}>Use a different key</button>
          </>
        ) : (
          <>
            <label className="field">
              <span>Pl@ntNet API key</span>
              <input type="password" value={key} onChange={(e) => onKeyInput(e.target.value)} placeholder="Paste the key or a setup link" autoCapitalize="off" autoCorrect="off" />
            </label>
            <p className="muted">Free at <a href="https://my.plantnet.org" target="_blank" rel="noreferrer">my.plantnet.org</a> (500 identifications a day). The key stays on this phone.{keyEdited && ' Tap Save settings to keep it.'}</p>
            {BUILT_IN_KEY && <button type="button" className="btn small link" onClick={switchToBuiltInKey}>Use the built-in key instead</button>}
          </>
        )}
        {savedKey !== undefined && (savedKey || key.trim() || BUILT_IN_KEY) && (
          <>
            <button type="button" className="btn block" onClick={testKey} disabled={testing}>
              {testing ? 'Testing…' : 'Test photo identification'}
            </button>
            <p className="muted">Sends a sample photo of a spider plant to Pl@ntNet, so you can check the key without a plant nearby. Uses 1 of today’s identifications.</p>
            {testResult && <p className={`notice ${testResult.ok ? 'ok' : 'err'} mt`} role="status">{testResult.text}</p>}
          </>
        )}
        {savedKey && (
          <>
            <button type="button" className="btn block mt" onClick={share}>Share setup link</button>
            <p className="muted">Sends a link that sets up photo identification on another phone in one tap. Share it only with people you trust; it uses your daily identifications.</p>
            {shareNote && <p className="notice ok mt">{shareNote}</p>}
          </>
        )}
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
        <p>Photo identification is by <a href="https://plantnet.org" target="_blank" rel="noreferrer">Pl@ntNet</a>.</p>
        <p className="muted">Test photo: “Spider Plant, houseplant view” by Joanne Kollar (Pitt County), <a href="https://plants.ces.ncsu.edu/plants/chlorophytum-comosum/" target="_blank" rel="noreferrer">NC State Extension</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.</p>
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
