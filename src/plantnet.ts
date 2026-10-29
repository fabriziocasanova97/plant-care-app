// Pl@ntNet identification API — https://my.plantnet.org/doc/api/identify
export interface Candidate {
  score: number
  scientificName: string
  commonNames: string[]
  genus: string
  family: string
}

export async function identify(image: Blob, apiKey: string): Promise<{ candidates: Candidate[]; remaining: number | null }> {
  const form = new FormData()
  form.append('images', image, 'plant.jpg')
  form.append('organs', 'auto')
  const url = new URL('https://my-api.plantnet.org/v2/identify/all')
  url.searchParams.set('api-key', apiKey)
  url.searchParams.set('nb-results', '5')
  url.searchParams.set('lang', 'en')

  const res = await fetch(url, { method: 'POST', body: form })
  if (res.status === 401) throw new Error('Pl@ntNet rejected the API key. Check it in Settings.')
  if (res.status === 404) throw new Error('Pl@ntNet could not recognize a plant in this photo. Try a closer photo of a leaf or flower.')
  if (!res.ok) throw new Error(`Pl@ntNet error ${res.status}`)
  const json = await res.json()
  return {
    remaining: json.remainingIdentificationRequests ?? null,
    candidates: (json.results ?? []).map((r: any) => ({
      score: r.score,
      scientificName: r.species?.scientificNameWithoutAuthor ?? r.species?.scientificName ?? '',
      commonNames: r.species?.commonNames ?? [],
      genus: r.species?.genus?.scientificNameWithoutAuthor ?? '',
      family: r.species?.family?.scientificNameWithoutAuthor ?? '',
    })),
  }
}

/** Downscale a photo so uploads are quick on mobile data. */
export async function shrinkImage(file: Blob, maxSide = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85))
}
