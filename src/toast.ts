// One app-wide message strip just above the tab bar, optionally with an action ("Undo").
import { useEffect, useState } from 'react'
import { markWatered, undoWatering } from './db'

export interface Toast {
  text: string
  cls?: 'ok' | 'err' | 'info'
  action?: { label: string; run: () => void }
}

let current: Toast | null = null
let timer: number | undefined
const listeners = new Set<(t: Toast | null) => void>()

export function showToast(t: Toast | null, ms = 5000) {
  current = t
  window.clearTimeout(timer)
  if (t) timer = window.setTimeout(() => showToast(null), ms)
  listeners.forEach((l) => l(current))
}

export function useToast(): Toast | null {
  const [t, setT] = useState<Toast | null>(current)
  useEffect(() => {
    listeners.add(setT)
    return () => { listeners.delete(setT) }
  }, [])
  return t
}

/** "Watered" with a few seconds to take it back, for mistaken taps. */
export async function waterWithUndo(plantId: number, name: string) {
  const u = await markWatered(plantId)
  showToast({
    text: `Watered ${name}.`,
    cls: 'ok',
    action: { label: 'Undo', run: () => { undoWatering(u); showToast(null) } },
  }, 6000)
}
