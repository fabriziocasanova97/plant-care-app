import { useEffect, useRef, useState } from 'react'
import type { Route } from '../App'
import { db, getSetting } from '../db'
import { identify, shrinkImage, type Candidate } from '../plantnet'
import { findByScientificName, searchPlants, displayName, type NcsuPlant } from '../data/ncsu'
import { CareInfo } from '../components/CareInfo'
import { PlantThumb } from '../components/PlantThumb'

type Step = 'photo' | 'identifying' | 'choose' | 'details'

const matchNotes = {
  species: undefined,
  synonym: 'NC State lists this plant under a newer name; the profile below is the same species.',
  cultivar: 'NC State has a profile for a variety of this species; care notes below are for that variety.',
  genus: 'NC State has no profile for this exact species. The notes below are for the genus, so some details may differ.',
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
      <h1>Scan a plant</h1>
      <input ref={fileInput} className="hidden-input" type="file" accept="image/*" capture="environment"
        onChange={(e) => onFile(e.target.files?.[0])} />

      {step === 'photo' && (
        <div className="empty">
          <div className="big">📷</div>
          <p>Take a clear photo of one leaf or flower, filling most of the frame.</p>
          <div className="stack">
            <button className="btn primary" onClick={() => fileInput.current?.click()}>Take a photo</button>
            <button className="btn" onClick={() => { setStep('choose') }}>Or pick by name</button>
          </div>
          {!apiKey && <p className="notice" style={{ marginTop: 16 }}>Photo identification needs a Pl@ntNet API key. Add it in Settings.</p>}
        </div>
      )}

      {step === 'identifying' && (
        <div className="empty">
          <PlantThumb photo={photo} big />
          <p>Asking Pl@ntNet…</p>
        </div>
      )}

      {step === 'choose' && (
        <div className="stack">
          {photo && <PlantThumb photo={photo} big />}
          {error && <p className="notice err">{error}</p>}
          {candidates.length > 0 && (
            <>
              <h2>Which one is it?</h2>
              <p className="muted">Matches from Pl@ntNet, most likely first. Below 30% is a guess.</p>
              {candidates.map((c, i) => {
                const inNcsu = findByScientificName(c.scientificName)
                return (
                  <button key={i} className="candidate" onClick={() => choose(c)}>
                    <span className={`score ${c.score < 0.3 ? 'low' : ''}`}>{Math.round(c.score * 100)}%</span>
                    <span className="grow">
                      <div className="title">{c.commonNames[0] ?? c.scientificName}</div>
                      <div className="muted">{c.scientificName}{inNcsu ? ` · care info: ${inNcsu.match === 'species' ? 'yes' : 'partial'}` : ' · no NC State profile'}</div>
                    </span>
                  </button>
                )
              })}
              {remaining !== null && <p className="muted">{remaining} free identifications left today.</p>}
            </>
          )}
          <h2>{candidates.length > 0 ? 'None of these? Search by name' : 'Search by name'}</h2>
          <input type="text" placeholder="e.g. pothos, monstera, snake plant" value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)} />
          {manualResults.map((p) => (
            <button key={p.slug} className="candidate" onClick={() => chooseManual(p)}>
              <span className="grow">
                <div className="title">{displayName(p, manualQuery)}</div>
                <div className="muted">{p.scientificName}</div>
              </span>
            </button>
          ))}
          <button className="btn" onClick={() => { setStep('photo'); setCandidates([]); setError(null) }}>Retake photo</button>
        </div>
      )}

      {step === 'details' && chosen && (
        <div className="stack">
          <label className="field">
            <span>Name this plant</span>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </label>
          <label className="field">
            <span>Water every</span>
            <div className="stepper">
              <button onClick={() => setDays((d) => Math.max(1, d - 1))}>−</button>
              <strong>{days} day{days === 1 ? '' : 's'}</strong>
              <button onClick={() => setDays((d) => Math.min(60, d + 1))}>+</button>
            </div>
          </label>
          <p className="muted">This interval is your choice; NC State describes conditions rather than a schedule. Read the care notes below and adjust it any time.</p>
          <button className="btn primary block" onClick={save}>Save plant</button>

          {ncsu ? (
            <CareInfo plant={ncsu.plant} matchNote={matchNotes[ncsu.match]} />
          ) : (
            <p className="notice">
              NC State Extension has no houseplant profile for <i>{chosen.scientificName}</i>, so there are no care notes to show.
              You can still track watering. <a href={`https://plants.ces.ncsu.edu/find_a_plant/?q=${encodeURIComponent(chosen.scientificName)}`} target="_blank" rel="noreferrer">Search NC State</a>
            </p>
          )}
          <button className="btn" onClick={() => setStep('choose')}>Back</button>
        </div>
      )}
    </div>
  )
}
