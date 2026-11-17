export type JobStatus = 'draft' | 'scheduled' | 'in_progress' | 'waiting' | 'done' | 'billable' | 'invoiced'

export const JOB_STATUS: Record<JobStatus, { label: string; cls: string; color: string }> = {
  draft: { label: 'Luonnos', cls: 'bg-slate-100 text-slate-700', color: '#94a3b8' },
  scheduled: { label: 'Suunniteltu', cls: 'bg-sky-100 text-sky-800', color: '#0284c7' },
  in_progress: { label: 'Käynnissä', cls: 'bg-amber-100 text-amber-800', color: '#d97706' },
  waiting: { label: 'Odottaa', cls: 'bg-rose-100 text-rose-800', color: '#e11d48' },
  done: { label: 'Valmis', cls: 'bg-emerald-100 text-emerald-800', color: '#059669' },
  billable: { label: 'Laskutettavissa', cls: 'bg-violet-100 text-violet-800', color: '#7c3aed' },
  invoiced: { label: 'Laskutettu', cls: 'bg-slate-200 text-slate-600', color: '#64748b' },
}

export const READINESS: Record<string, { label: string; cls: string }> = {
  no_materials: { label: 'Ei tarvikkeita', cls: 'bg-slate-100 text-slate-600' },
  none: { label: 'Tarvikkeet hakematta', cls: 'bg-slate-100 text-slate-700' },
  partial: { label: 'Osa tarvikkeista haettu', cls: 'bg-amber-100 text-amber-800' },
  ready: { label: 'Tarvikkeet haettu', cls: 'bg-emerald-100 text-emerald-800' },
  missing: { label: 'Tarvike puuttuu', cls: 'bg-rose-100 text-rose-800' },
}

export const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: 'Uusi', cls: 'bg-sky-100 text-sky-800' },
  in_progress: { label: 'Työn alla', cls: 'bg-amber-100 text-amber-800' },
  quoted: { label: 'Tarjottu', cls: 'bg-violet-100 text-violet-800' },
  accepted: { label: 'Hyväksytty', cls: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Hylätty', cls: 'bg-slate-200 text-slate-600' },
}

export const QUOTE_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Luonnos', cls: 'bg-slate-100 text-slate-700' },
  sent: { label: 'Lähetetty', cls: 'bg-sky-100 text-sky-800' },
  accepted: { label: 'Hyväksytty', cls: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Hylätty', cls: 'bg-slate-200 text-slate-600' },
}

export const SOURCE_LABEL: Record<string, string> = {
  phone: 'Puhelin',
  form: 'Verkkolomake',
  email: 'Sähköposti',
  voice: 'Sanelu',
  other: 'Muu',
}

export function fmtMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined || Number.isNaN(min)) return '–'
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r} min`
  return r === 0 ? `${h} h` : `${h} h ${r} min`
}

export function fmtHours(min: number | null | undefined): string {
  if (!min) return '0,00'
  return (min / 60).toFixed(2).replace('.', ',')
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '–'
  const date = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00' : d) : d
  return date.toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

export function fmtWeekday(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

export function fmtTime(d: string | Date | null | undefined): string {
  if (!d) return '–'
  return new Date(d).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '–'
  return `${fmtDate(d)} ${fmtTime(d)}`
}

export function fmtEur(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('fi-FI', { style: 'currency', currency: 'EUR' })
}

export function fmtQty(n: number | null | undefined): string {
  if (n === null || n === undefined) return '–'
  return Number(n).toLocaleString('fi-FI', { maximumFractionDigits: 3 })
}

/** Kuinka vanha sijainti on, ihmisen luettavana. */
export function fmtAge(iso: string, now = Date.now()): string {
  const min = Math.round((now - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'juuri nyt'
  if (min < 60) return `${min} min sitten`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h sitten`
  return fmtDateTime(iso)
}

/** Sijainti on vanhentunut, jos se on yli 10 min vanha. */
export const STALE_LOCATION_MIN = 10

export function isoDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return isoDate(d)
}

export function errorMessage(e: unknown): string {
  if (!e) return 'Tuntematon virhe'
  if (typeof e === 'string') return e
  if (typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    const msg = (e as { message: string }).message
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Ei verkkoyhteyttä'
    return msg
  }
  return String(e)
}

export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // randomUUID puuttuu ei-suojatussa yhteydessä (http + LAN-IP)
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// ---- Käyntien kellonajat ----------------------------------------------------------

/** "08:30:00" -> 510 (minuuttia keskiyöstä) */
export function timeToMin(t: string | null | undefined): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** 510 -> "8.30" (suomalainen kellonaika) */
export function minToClock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${Math.floor(m / 60)}.${String(m % 60).padStart(2, '0')}`
}

/** 510 -> "08:30" (time-kentän arvo) */
export function minToInput(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Käynnin kesto: oma kesto -> työn arvio -> 60 min (sama kuin tietokannan visit_duration). */
export function visitMinutes(durationMinutes: number | null | undefined, estimatedHours: number | null | undefined): number {
  if (durationMinutes) return durationMinutes
  if (estimatedHours && Number(estimatedHours) > 0) return Math.round(Number(estimatedHours) * 60)
  return 60
}

/** "8.00–10.00" tai null, jos kellonaikaa ei ole. */
export function visitRange(start: string | null | undefined, minutes: number): string | null {
  const s = timeToMin(start)
  return s === null ? null : `${minToClock(s)}–${minToClock(s + minutes)}`
}

/** Päällekkäiset käynnit (sama asentaja ja päivä): palauttaa päällekkäisten id:t. */
export function overlappingIds(visits: { id: string; start: number | null; minutes: number }[]): Set<string> {
  const timed = visits.filter((v) => v.start !== null).sort((a, b) => a.start! - b.start!)
  const out = new Set<string>()
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length && timed[j].start! < timed[i].start! + timed[i].minutes; j++) {
      out.add(timed[i].id)
      out.add(timed[j].id)
    }
  }
  return out
}

/** Järjestys: kellonaika, ilman aikaa olevat viimeisenä, sitten sort. */
export function byVisitTime<T extends { start_time?: string | null; sort?: number }>(a: T, b: T): number {
  const ta = timeToMin(a.start_time) ?? 9999
  const tb = timeToMin(b.start_time) ?? 9999
  return ta - tb || (a.sort ?? 0) - (b.sort ?? 0)
}
