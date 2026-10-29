import type { Plant } from './db'

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

/** A repeating all-day calendar event ("Water <plant>") with a morning alert. */
export function wateringEvent(p: Plant, firstDue: number, hour: number): string {
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => '\\' + c)
  // The alert fires `hour` hours after the start of the all-day event.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plant Pal//EN',
    'BEGIN:VEVENT',
    `UID:plant-pal-${p.id}-${Date.now()}@plant-care-app`,
    `DTSTAMP:${fmtDate(Date.now())}T000000Z`,
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
  ].join('\r\n')
}

export function downloadIcs(filename: string, body: string) {
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
