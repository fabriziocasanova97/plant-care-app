/** 0–23 → "12 am", "9 am", "12 pm", "3 pm". */
export function formatHour(h: number): string {
  if (h === 0) return '12 am'
  if (h < 12) return `${h} am`
  if (h === 12) return '12 pm'
  return `${h - 12} pm`
}
