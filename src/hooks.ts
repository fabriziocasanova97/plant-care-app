import { useLiveQuery } from 'dexie-react-hooks'
import { db, WINTER_EXTRA_DEFAULT } from './db'

export interface WinterSettings {
  /** False until the settings have been read, so screens can wait instead of flashing summer values. */
  loaded: boolean
  on: boolean
  /** Percent longer intervals get in winter mode, e.g. 50. */
  extra: number
  /** 0 when off, else extra / 100. */
  factor: number
}

/** Live winter-mode settings; re-renders when they change anywhere in the app. */
export function useWinter(): WinterSettings {
  const rows = useLiveQuery(() => db.settings.bulkGet(['winterMode', 'winterExtra']), [])
  const on = rows?.[0]?.value === '1'
  const extra = Number(rows?.[1]?.value ?? WINTER_EXTRA_DEFAULT)
  return { loaded: rows !== undefined, on, extra, factor: on ? extra / 100 : 0 }
}
