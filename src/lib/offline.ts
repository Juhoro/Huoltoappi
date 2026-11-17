// Paikallinen tila (IndexedDB): lähetysjono, käynnissä oleva ajanotto ja raporttiluonnokset.
// Jono lähettää komennot järjestyksessä; palvelin käsittelee duplikaatit idempotentisti (event_id).

import { openDB, type IDBPDatabase } from 'idb'
import { supabase } from './supabase'
import { errorMessage } from './format'

export type OutboxItem = {
  id?: number
  kind: string // RPC-funktion nimi tai 'insert:<taulu>'
  payload: Record<string, unknown>
  label: string
  createdAt: number
  attempts: number
  failed?: string // pysyvä virhe, käyttäjän korjattava
}

type Schema = {
  outbox: { key: number; value: OutboxItem }
  kv: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null
function db() {
  dbPromise ??= openDB<Schema>('huoltoputki', 1, {
    upgrade(d) {
      d.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true })
      d.createObjectStore('kv')
    },
  })
  return dbPromise
}

// ---- avain-arvo (ajanotto, luonnokset) ----------------------------------------------

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    return (await (await db()).get('kv', key)) as T | undefined
  } catch {
    return undefined
  }
}

export async function kvSet(key: string, value: unknown) {
  try {
    await (await db()).put('kv', value, key)
  } catch {
    /* IndexedDB ei käytettävissä (yksityinen ikkuna) – jatketaan ilman */
  }
}

export async function kvDel(key: string) {
  try {
    await (await db()).delete('kv', key)
  } catch {
    /* ohitetaan */
  }
}

export type ActiveTimer = { jobId: string; eventId: string; startedAt: string; jobTitle: string }
export const TIMER_KEY = 'active-timer'
export const draftKey = (jobId: string) => `report-draft:${jobId}`

// ---- lähetysjono -----------------------------------------------------------------

const listeners = new Set<() => void>()
export function onOutboxChange(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
function notify() {
  listeners.forEach((fn) => fn())
}

export async function outboxItems(): Promise<OutboxItem[]> {
  try {
    return await (await db()).getAll('outbox')
  } catch {
    return []
  }
}

export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = errorMessage(e)
  return msg === 'Ei verkkoyhteyttä' || /fetch|network|timeout/i.test(msg)
}

async function send(kind: string, payload: Record<string, unknown>) {
  if (kind.startsWith('insert:')) {
    const { error } = await supabase.from(kind.slice(7) as 'location_pings').insert(payload as never)
    if (error) throw error
    return null
  }
  const { data, error } = await supabase.rpc(kind as never, payload as never)
  if (error) throw error
  return data
}

/**
 * Suorittaa komennon heti, tai verkkokatkon sattuessa jonottaa sen.
 * Palvelinvirhe (esim. oikeus tai virheellinen tila) heitetään käyttäjälle.
 */
export async function runOrQueue<T = unknown>(
  kind: string,
  payload: Record<string, unknown>,
  label: string,
): Promise<{ queued: boolean; data?: T }> {
  // Jos jonossa on jo jotain, säilytetään järjestys.
  const pending = (await outboxItems()).filter((i) => !i.failed)
  if (pending.length === 0 && navigator.onLine) {
    try {
      return { queued: false, data: (await send(kind, payload)) as T }
    } catch (e) {
      if (!isNetworkError(e)) throw e
    }
  }
  await (await db()).add('outbox', { kind, payload, label, createdAt: Date.now(), attempts: 0 })
  notify()
  // Jos verkko on päällä (jonossa oli vain aiempia kirjauksia), lähetetään heti.
  if (navigator.onLine) void flushOutbox()
  return { queued: true }
}

let flushing: Promise<void> | null = null
let flushAgain = false

/**
 * Lähettää jonon järjestyksessä, kunnes se on tyhjä (myös lähetyksen aikana lisätyt).
 * Palauttaa lupauksen, joka valmistuu kun jono on käsitelty tai verkko katkesi.
 */
export function flushOutbox(): Promise<void> {
  if (flushing) {
    flushAgain = true
    return flushing
  }
  flushing = (async () => {
    try {
      const d = await db()
      do {
        flushAgain = false
        if (!navigator.onLine) return
        const items = (await d.getAll('outbox')).filter((i) => !i.failed)
        for (const item of items) {
          try {
            await send(item.kind, item.payload)
            await d.delete('outbox', item.id!)
          } catch (e) {
            if (isNetworkError(e)) return
            await d.put('outbox', { ...item, attempts: item.attempts + 1, failed: errorMessage(e) })
          }
          notify()
        }
        if (items.length > 0) flushAgain = (await d.getAll('outbox')).some((i) => !i.failed)
      } while (flushAgain)
    } catch {
      /* IndexedDB ei käytettävissä */
    } finally {
      flushing = null
      notify()
    }
  })()
  return flushing
}

export async function discardOutboxItem(id: number) {
  await (await db()).delete('outbox', id)
  notify()
}

export async function retryOutboxItem(id: number) {
  const d = await db()
  const item = await d.get('outbox', id)
  if (item) await d.put('outbox', { ...item, failed: undefined })
  notify()
  await flushOutbox()
}

/** Poistaa paikalliset luonnokset ja jonon uloskirjautuessa (suojattavat tiedot). */
export async function clearLocalData() {
  try {
    const d = await db()
    await d.clear('outbox')
    await d.clear('kv')
  } catch {
    /* ohitetaan */
  }
  notify()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushOutbox())
  setInterval(() => void flushOutbox(), 30_000)
}
