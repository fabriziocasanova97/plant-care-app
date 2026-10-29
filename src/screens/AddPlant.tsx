import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Route } from '../App'
import { db, getSetting } from '../db'
import { identify, shrinkImage, type Candidate } from '../plantnet'
import { findByScientificName, searchPlants, displayName, type NcsuPlant } from '../data/ncsu'
import { CareInfo } from '../components/CareInfo'
import { PlantThumb } from '../components/PlantThumb'
import { CameraIcon, SearchIcon, SproutArt } from '../components/Icons'

type Step = 'photo' | 'identifying' | 'choose' | 'details'

const matchNotes = {
  species: undefined,
  synonym: 'NC State lists this plant under a newer name; the profile below is the same species.',
  cultivar: 'NC State has a profile for a variety of this species; care notes below are for that variety.',
  genus: 'NC State has no profile for this exact species. The notes below are for the genus, so some details may differ.',
}

const STEPS: { key: Step[]; label: string }[] = [
  { key: ['photo'], label: 'Photo' },
  { key: ['identifying', 'choose'], label: 'Match' },
  { key: ['details'], label: 'Details' },
]

function Steps({ step }: { step: Step }) {
  const idx = STEPS.findIndex((s) => s.key.includes(step))
  return (
    <ol className="steps" aria-label={`Step ${idx + 1} of ${STEPS.length}`}>
      {STEPS.map((s, i) => (
        <li key={s.label} className={i < idx ? 'done' : i === idx ? 'current' : ''} aria-current={i === idx ? 'step' : undefined}>{s.label}</li>
      ))}
    </ol>
  )
}

function careTag(name: string) {
  const m = findByScientificName(name)
  if (!m) return <span className="tag">No care notes</span>
  if (m.match === 'species') return <span className="tag yes">Care notes available</span>
  return <span className="tag part">Related care notes</span>
}

export default function AddPlant({ go }: { go: (r: Route) => void }) {
  const [step, setStep] = useState<Step>('photo')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [apiKey, setApiKey] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [remaining, setRemaining] = useState<number | null>(null)
  const [chosen, setChosen] = useState<Candidate | null>(null)
  const [ncsu, setNcsu] = useState<ReturnType<typeof findByScientificName>>(null)
  const [manualQuery, setManualQuery] = useState('')
  const [nickname, setNickname] = useState('')
  const [days, setDays] = useState(7)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { getSetting('plantnetKey').then(setApiKey) }, [])

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    let small: Blob
    try {
      small = await shrinkImage(file)
    } catch (e) {
      setError(`Could not read that photo (${(e as Error).message}). Try taking it again.`)
      return
    }
    setPhoto(small)
    if (!apiKey) {
      setError('No Pl@ntNet API key yet. Add it in Settings, or pick the plant by name below.')
      setStep('choose')
      return
    }
    setStep('identifying')
    try {
      const r = await identify(small, apiKey)
      setCandidates(r.candidates)
      setRemaining(r.remaining)
      if (r.candidates.length === 0) setError('Pl@ntNet returned no match. You can pick the plant by name below.')
    } catch (e) {
      setError((e as Error).message)
    }
    setStep('choose')
  }

  function choose(c: Candidate) {
    setChosen(c)
    const m = findByScientificName(c.scientificName)
    setNcsu(m)
    setNickname(c.commonNames[0] ?? c.scientificName)
    setStep('details')
  }

  function chooseManual(p: NcsuPlant) {
    setChosen({ score: 1, scientificName: p.scientificName, commonNames: p.commonNames, genus: '', family: '' })
    setNcsu({ plant: p, match: 'species' })
    setNickname(displayName(p, manualQuery))
    setStep('details')
  }

  async function save() {
    const id = await db.plants.add({
      nickname: nickname.trim() || chosen?.scientificName || 'My plant',
      ncsuSlug: ncsu?.plant.slug ?? null,
      identifiedAs: chosen,
      photo,
      intervalDays: days,
      lastWateredAt: null,
      createdAt: Date.now(),
    })
    go({ name: 'plant', id: id as number })
  }

  const manualResults = manualQuery.length >= 2 ? searchPlants(manualQuery) : []

  return (
    <div>
      <div className="screen-head"><h1>Add a plant</h1></div>
      <Steps step={step} />
      <input ref={fileInput} className="hidden-input" type="file" accept="image/*" capture="environment"
        onChange={(e) => onFile(e.target.files?.[0])} />

      {step === 'photo' && (
        <div className="scan-hero">
          <SproutArt />
          <p>Take a clear photo of one leaf or flower, filling most of the frame.</p>
          <div className="stack">
            <button className="btn primary" onClick={() => fileInput.current?.click()}><CameraIcon /> Take a photo</button>
            <button className="btn" onClick={() => { setStep('choose') }}><SearchIcon /> Find by name instead</button>
          </div>
          {!apiKey && <p className="notice" style={{ marginTop: 16, textAlign: 'left' }}>Photo identification needs a Pl@ntNet API key. Add it in Settings. Finding a plant by name works without one.</p>}
        </div>
      )}

      {step === 'identifying' && (
        <div className="identifying stack">
          <PlantThumb photo={photo} big />
          <p className="muted"><span className="pulse" />Asking Pl@ntNet…</p>
        </div>
      )}

      {step === 'choose' && (
        <div className="stack">
          {photo && <PlantThumb photo={photo} big />}
          {error && <p className="notice err">{error}</p>}
          {candidates.length > 0 && (
            <>
              <h2>Which one is it?</h2>
              <p className="muted" style={{ marginTop: -4 }}>Matches from Pl@ntNet, most likely first. Below 30% is a guess.</p>
              {candidates.map((c, i) => {
                const pct = Math.round(c.score * 100)
                return (
                  <button key={i} className="candidate" onClick={() => choose(c)}>
                    <span className={`score ${c.score < 0.3 ? 'low' : ''}`} style={{ '--p': pct } as CSSProperties} data-score={`${pct}%`} aria-label={`${pct}% match`} />
                    <span className="grow">
                      <div className="title">{c.commonNames[0] ?? c.scientificName}</div>
                      <div className="muted sci">{c.scientificName}</div>
                      {careTag(c.scientificName)}
                    </span>
                  </button>
                )
              })}
              {remaining !== null && <p className="muted">{remaining} free identifications left today.</p>}
            </>
          )}
          <h2>{candidates.length > 0 ? 'None of these? Find it by name' : 'Find it by name'}</h2>
          <div className="search">
            <SearchIcon />
            <input type="text" placeholder="pothos, monstera, snake plant…" value={manualQuery} autoFocus={candidates.length === 0 && !photo}
              onChange={(e) => setManualQuery(e.target.value)} aria-label="Plant name" />
          </div>
          {manualQuery.length >= 2 && manualResults.length === 0 && (
            <p className="muted">No houseplant called “{manualQuery}” in the NC State list. Try another common name or the Latin name.</p>
          )}
          {manualResults.map((p) => (
            <button key={p.slug} className="candidate" onClick={() => chooseManual(p)}>
              <span className="grow">
                <div className="title">{displayName(p, manualQuery)}</div>
                <div className="muted sci">{p.scientificName}</div>
              </span>
            </button>
          ))}
          <button className="btn" onClick={() => { setStep('photo'); setCandidates([]); setError(null) }}>
            <CameraIcon /> {photo ? 'Retake photo' : 'Take a photo instead'}
          </button>
        </div>
      )}

      {step === 'details' && chosen && (
        <div className="stack">
          <div className="card">
            <label className="field" style={{ marginTop: 0 }}>
              <span>Name this plant</span>
              <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </label>
            <label className="field">
              <span>Water every</span>
              <div className="stepper">
                <button type="button" aria-label="Fewer days" onClick={() => setDays((d) => Math.max(1, d - 1))}>−</button>
                <strong>{days} day{days === 1 ? '' : 's'}</strong>
                <button type="button" aria-label="More days" onClick={() => setDays((d) => Math.min(60, d + 1))}>+</button>
              </div>
            </label>
            <p className="muted">This interval is your choice; NC State describes conditions rather than a schedule. Read the care notes below and adjust it any time.</p>
            <button className="btn primary block" onClick={save}>Save plant</button>
          </div>

          {ncsu ? (
            <CareInfo plant={ncsu.plant} matchNote={matchNotes[ncsu.match]} />
          ) : (
            <p className="notice">
              NC State Extension has no houseplant profile for <i>{chosen.scientificName}</i>, so there are no care notes to show.
              You can still track watering. <a href={`https://plants.ces.ncsu.edu/find_a_plant/?q=${encodeURIComponent(chosen.scientificName)}`} target="_blank" rel="noreferrer">Search NC State</a>
            </p>
          )}
          <button className="btn" onClick={() => setStep('choose')}>Back to matches</button>
        </div>
      )}
    </div>
  )
}
