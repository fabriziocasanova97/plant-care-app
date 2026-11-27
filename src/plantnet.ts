// Pl@ntNet identification API — https://my.plantnet.org/doc/api/identify
export interface Candidate {
  score: number
  scientificName: string
  commonNames: string[]
  genus: string
  family: string
}

const KEY_SETTINGS_HINT =
  "On my.plantnet.org/settings/api-key, check that “expose my API key” is ticked and that fabriziocasanova97.github.io is an authorized domain."

export async function identify(image: Blob, apiKey: string): Promise<{ candidates: Candidate[]; remaining: number | null }> {
  // Pl@ntNet only accepts JPEG and PNG. Photos the phone could decode were already turned into JPEG.
  if (image.type && !/^image\/(jpeg|png)$/.test(image.type)) {
    throw new Error('This photo format isn’t supported. Take a new photo, or pick a different one.')
  }
  const form = new FormData()
  form.append('images', image, 'plant.jpg')
  form.append('organs', 'auto')
  const url = new URL('https://my-api.plantnet.org/v2/identify/all')
  url.searchParams.set('api-key', apiKey)
  url.searchParams.set('nb-results', '5')
  url.searchParams.set('lang', 'en')

  let res: Response
  try {
    res = await fetch(url, { method: 'POST', body: form })
  } catch {
    // No response at all: either offline, or Pl@ntNet refused the browser request (key not exposed / domain not allowed).
    throw new Error(navigator.onLine === false
      ? 'No internet connection. Photo identification needs internet; everything else works offline.'
      : `Could not reach Pl@ntNet. ${KEY_SETTINGS_HINT}`)
  }
  if (res.status === 401 || res.status === 403) throw new Error(`Pl@ntNet did not accept the API key. Check the key in Settings. ${KEY_SETTINGS_HINT}`)
  if (res.status === 404) throw new Error('Pl@ntNet could not recognize a plant in this photo. Try a closer photo of a leaf or flower.')
  if (res.status === 429) throw new Error('Today’s free identifications are used up. They reset tomorrow; finding a plant by name still works.')
  if (!res.ok) throw new Error(`Pl@ntNet had a problem (error ${res.status}). Try again in a minute.`)
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

/**
 * Check the saved key end to end without needing a plant nearby: send NC State's spider plant
 * photo (Joanne Kollar, CC BY 4.0, bundled as test-plant.jpg) and return Pl@ntNet's top answer.
 */
export async function testIdentification(apiKey: string) {
  const res = await fetch(import.meta.env.BASE_URL + 'test-plant.jpg')
  if (!res.ok) throw new Error('Could not load the test photo. Check the internet connection and try again.')
  const r = await identify(await res.blob(), apiKey)
  if (!r.candidates.length) throw new Error('Pl@ntNet answered but returned no match for the test photo. Try again in a minute.')
  return { top: r.candidates[0], remaining: r.remaining }
}

/** Downscale a photo so uploads are quick on mobile data. Falls back to the original if the browser can't decode it. */
export async function shrinkImage(file: Blob, maxSide = 1280): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    // 'from-image' applies the EXIF rotation so portrait phone photos aren't stored sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85))
}
