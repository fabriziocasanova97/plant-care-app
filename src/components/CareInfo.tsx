import { careAttributes, careSentences, poisonAttributes, pestAttributes, descriptionParagraphs, toxicityTags, SOURCE_NAME, dataset, type NcsuPlant } from '../data/ncsu'

/** Everything shown here is copied from the NC State profile linked at the bottom. */
export function CareInfo({ plant, matchNote }: { plant: NcsuPlant; matchNote?: string }) {
  const tips = careSentences(plant)
  const poison = poisonAttributes(plant)
  const tox = toxicityTags(plant)
  return (
    <div className="card">
      <div className="title">{plant.scientificName}</div>
      {plant.commonNames.length > 0 && <div className="muted">{plant.commonNames.join(' · ')}</div>}
      {matchNote && <p className="notice" style={{ marginTop: 10 }}>{matchNote}</p>}

      {tips.length > 0 && (
        <>
          <h3>Care notes</h3>
          {tips.map((s, i) => <p key={i}>{s}</p>)}
        </>
      )}

      <h3>Growing conditions</h3>
      {careAttributes(plant).map(([label, values]) => (
        <div className="fact" key={label}>
          <b>{label}</b>
          {values.join('; ')}
        </div>
      ))}

      {(poison.length > 0 || tox.length > 0) && (
        <>
          <h3>Toxicity</h3>
          {poison.map(([label, values]) => (
            <div className="fact" key={label}><b>{label}</b>{values.join(' ')}</div>
          ))}
          {tox.length > 0 && <p className="muted">{tox.join(' ')}</p>}
        </>
      )}

      {pestAttributes(plant).length > 0 && (
        <>
          <h3>Common problems</h3>
          {pestAttributes(plant).map(([label, values]) => (
            <div className="fact" key={label}><b>{label}</b>{values.join('; ')}</div>
          ))}
        </>
      )}

      {descriptionParagraphs(plant).length > 0 && (
        <>
          <h3>About this plant</h3>
          {descriptionParagraphs(plant).map((d, i) => <p key={i}>{d}</p>)}
        </>
      )}

      <div className="source">
        Source: <a href={plant.url} target="_blank" rel="noreferrer">{SOURCE_NAME}</a>
        {' '}· copied {new Date(dataset.fetchedAt).toLocaleDateString()}
      </div>
    </div>
  )
}
