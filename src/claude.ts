// Plant identification with Claude (Anthropic Messages API), called straight from the phone.
// The key is the user's own, stored on the device. Docs: https://docs.anthropic.com/en/api/messages
import type { Candidate } from './plantnet'
import { dataset } from './data/ncsu'

/** Small, fast, cheap vision model. Swap for a bigger one here if identifications aren't good enough. */
export const CLAUDE_MODEL = 'claude-haiku-5-5'

const KNOWN_NAMES = dataset.plants.map((p) => p.scientificName).join('; ')

const PROMPT = `Identify the plant in this photo. It is most likely a houseplant.
Give up to 5 candidates, most likely first, each with a scientific name (genus and species, no author), one common name, and your confidence from 0 to 1.
When a candidate is on this list, use its name exactly as written: ${KNOWN_NAMES}.
If the plant is not on the list, give your best scientific name anyway.
If there is no plant in the photo, or it is too unclear to tell, return no candidates.`

const TOOL = {
  name: 'report_plants',
  description: 'Report the plant identification candidates for the photo.',
  input_schema: {
    type: 'object',
    properties: {
      candidates: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            scientificName: { type: 'string' },
            commonName: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['scientificName', 'commonName', 'confidence'],
        },
      },
    },
    required: ['candidates'],
  },
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(new Error('Could not read the photo.'))
    r.readAsDataURL(blob)
  })
}

async function apiMessage(res: Response): Promise<string> {
  try {
    const j = await res.json()
    return j?.error?.message ?? ''
  } catch {
    return ''
  }
}

export async function identifyWithClaude(image: Blob, apiKey: string): Promise<{ candidates: Candidate[]; remaining: number | null }> {
  const mediaType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(image.type) ? image.type : 'image/jpeg'
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: await toBase64(image) } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const detail = await apiMessage(res)
    if (res.status === 401) throw new Error('Claude rejected the API key. Check it in Settings.')
    if (res.status === 403) throw new Error(`Claude refused this key (403)${detail ? `: ${detail}` : ''}`)
    if (res.status === 429) throw new Error('Too many requests to Claude right now. Wait a minute and try again.')
    if (res.status === 400 && /credit/i.test(detail)) throw new Error('The Claude account is out of credit. Add credit at console.anthropic.com.')
    if (res.status === 529 || res.status >= 500) throw new Error('Claude is busy right now. Try again in a moment, or pick the plant by name.')
    throw new Error(`Claude error ${res.status}${detail ? `: ${detail}` : ''}`)
  }

  const json = await res.json()
  const block = (json.content ?? []).find((b: any) => b.type === 'tool_use')
  const list: any[] = Array.isArray(block?.input?.candidates) ? block.input.candidates : []
  const candidates: Candidate[] = list
    .filter((c) => typeof c?.scientificName === 'string' && c.scientificName.trim())
    .map((c) => {
      const scientificName = c.scientificName.trim()
      const score = Number(c.confidence)
      return {
        score: Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0,
        scientificName,
        commonNames: typeof c.commonName === 'string' && c.commonName.trim() ? [c.commonName.trim()] : [],
        genus: scientificName.split(/\s+/)[0],
        family: '',
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  return { candidates, remaining: null }
}
