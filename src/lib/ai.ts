// Edge Function -kutsut. AI on aina lisäominaisuus: virheessä palautetaan null ja
// käyttöliittymä jatkaa ilman ehdotusta.

import { supabase } from './supabase'

export type StructuredReport = {
  summary: string
  actions: string[]
  materials: { name: string; qty: string }[]
  issues: string[]
  follow_up: string[]
  customer_notes: string
}

export type ParsedRequest = {
  contact_name: string
  phone: string
  email: string
  address: string
  city: string
  description: string
  urgent: boolean
  uncertain_fields: string[]
}

export type QuoteSuggestion = {
  lines: { product_id: string; qty: number; reason: string }[]
  labor_hours: number
  notes: string
}

export type AiResult<T> = { ok: true; data: T } | { ok: false; reason: string }

async function call<T>(fn: string, body: Record<string, unknown>): Promise<AiResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body })
    if (error) {
      let reason = 'Tekoälypalvelu ei vastannut'
      try {
        const ctx = (error as { context?: Response }).context
        const j = ctx ? await ctx.json() : null
        if (j?.error) reason = j.error
      } catch {
        /* ohitetaan */
      }
      return { ok: false, reason }
    }
    if (data?.error) return { ok: false, reason: data.error }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, reason: 'Ei yhteyttä tekoälypalveluun' }
  }
}

export const structureReport = (text: string, jobTitle: string) =>
  call<StructuredReport>('structure-report', { text, jobTitle })

export const parseRequest = (text: string) => call<ParsedRequest>('parse-request', { text })

export const suggestQuote = (orgId: string, description: string) =>
  call<QuoteSuggestion>('suggest-quote', { orgId, description })

export const geocode = (address: string, city: string) =>
  call<{ lat: number; lng: number; display_name: string } | null>('geocode', { address, city })
