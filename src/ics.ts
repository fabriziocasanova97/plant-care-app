import type { Plant } from './db'

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

/**
 * A repeating all-day calendar event ("Water <plant>") with a morning alert.
 * The UID is stable per plant and SEQUENCE increases with time, so re-importing after
 * changing the interval replaces the earlier event instead of adding a second one.
 */
export function wateringEvent(p: Plant, firstDue: number, hour: number): string {
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => '\\' + c)
  const now = Date.now()
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plant Pal//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:plant-pal-${p.id}@plant-care-app`,
    `SEQUENCE:${Math.floor(now / 1000)}`,
    `DTSTAMP:${fmtDate(now)}T000000Z`,
    `DTSTART;VALUE=DATE:${fmtDate(firstDue)}`,
    `RRULE:FREQ=DAILY;INTERVAL=${p.intervalDays}`,
    `SUMMARY:${esc('Water ' + p.nickname)}`,
    `DESCRIPTION:${esc('Reminder from Plant Pal. Open the app to log it.')}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('Water ' + p.nickname)}`,
    `TRIGGER:PT${hour}H`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

/**
 * Hand the .ics to the phone. An installed (home-screen) iOS app cannot reliably "download" a
 * file, so the share sheet is tried first (it offers Calendar); plain download is the fallback.
 * Returns how it was delivered so the UI can explain the next step.
 */
export async function deliverIcs(filename: string, body: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([body], filename, { type: 'text/calendar' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled' // she closed the sheet
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }))
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  return 'downloaded'
}
