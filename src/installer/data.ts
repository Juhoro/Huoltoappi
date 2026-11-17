import { useCallback, useEffect, useState } from 'react'
import { addDays, isoDate } from '../lib/format'
import { kvGet, kvSet } from '../lib/offline'
import type { Need } from '../lib/picking'
import { supabase } from '../lib/supabase'

export type VisitJob = {
  id: string
  title: string
  description: string
  address: string | null
  city: string | null
  lat: number | null
  lng: number | null
  contact_name: string | null
  contact_phone: string | null
  priority: string
  status: string
  waiting_reason: string | null
  estimated_hours: number | null
}

export type MyVisit = {
  id: string
  visit_date: string
  start_time: string | null
  duration_minutes: number | null
  sort: number
  status: string
  job: VisitJob
  readiness: string | null
}

const ACTIVE = ['draft', 'scheduled', 'in_progress', 'waiting']

/**
 * Asentajan käynnit: tämä päivä, huominen ja aiemmat keskeneräiset.
 * Viimeisin onnistunut haku tallennetaan laitteelle, jotta lista näkyy myös ilman verkkoa.
 */
export function useMyVisits(userId: string) {
  const [visits, setVisits] = useState<MyVisit[] | null>(null)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheKey = `my-visits:${userId}`

  const load = useCallback(async () => {
    const today = isoDate()
    const { data, error } = await supabase
      .from('job_visits')
      .select(
        'id, visit_date, start_time, duration_minutes, sort, status, job:jobs(id, title, description, address, city, lat, lng, contact_name, contact_phone, priority, status, waiting_reason, estimated_hours)',
      )
      .eq('assigned_to', userId)
      .neq('status', 'cancelled')
      .gte('visit_date', addDays(today, -14))
      .lte('visit_date', addDays(today, 7))
      .order('visit_date')
      .order('start_time', { nullsFirst: false })
      .order('sort')
    if (error) {
      const cached = await kvGet<MyVisit[]>(cacheKey)
      if (cached) {
        setVisits(cached)
        setOffline(true)
      } else setError('Työlistaa ei saatu ladattua. Tarkista verkkoyhteys.')
      return
    }
    const rows = (data ?? []).filter((v) => v.job) as unknown as Omit<MyVisit, 'readiness'>[]
    const visible = rows.filter((v) => v.visit_date >= today || (ACTIVE.includes(v.job.status) && v.status !== 'done'))
    const ids = [...new Set(visible.map((v) => v.job.id))]
    const { data: ready } = ids.length
      ? await supabase.from('job_readiness').select('job_id, readiness').in('job_id', ids)
      : { data: [] as { job_id: string | null; readiness: string | null }[] }
    const rmap = new Map((ready ?? []).map((r) => [r.job_id, r.readiness]))
    const result = visible.map((v) => ({ ...v, readiness: rmap.get(v.job.id) ?? null }))
    setVisits(result)
    setOffline(false)
    setError(null)
    await kvSet(cacheKey, result)
  }, [userId, cacheKey])

  useEffect(() => {
    void load()
    const ch = supabase
      .channel(`my-visits-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_visits', filter: `assigned_to=eq.${userId}` }, () => void load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, () => void load())
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [load, userId])

  return { visits, offline, error, reload: load }
}

/** Avointen töiden tarvikkeet keräilylistaa ja skannausta varten. */
export async function loadNeeds(visits: MyVisit[]): Promise<Need[]> {
  const active = visits.filter((v) => ACTIVE.includes(v.job.status))
  const jobIds = [...new Set(active.map((v) => v.job.id))]
  if (jobIds.length === 0) return []
  const { data, error } = await supabase
    .from('job_material_status')
    .select('id, job_id, product_id, description, unit, qty_needed, qty_picked, missing')
    .in('job_id', jobIds)
  if (error) throw error
  const firstVisit = new Map<string, string>()
  const titles = new Map<string, string>()
  for (const v of active) {
    titles.set(v.job.id, v.job.title)
    const cur = firstVisit.get(v.job.id)
    if (!cur || v.visit_date < cur) firstVisit.set(v.job.id, v.visit_date)
  }
  return (data ?? []).map((m) => ({
    job_material_id: m.id!,
    job_id: m.job_id!,
    job_title: titles.get(m.job_id!) ?? '',
    visit_date: firstVisit.get(m.job_id!) ?? null,
    product_id: m.product_id,
    description: m.description ?? '',
    unit: m.unit ?? 'kpl',
    qty_needed: Number(m.qty_needed ?? 0),
    qty_picked: Number(m.qty_picked ?? 0),
    missing: !!m.missing,
  }))
}

export function mapsUrl(address: string | null, city: string | null) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address ?? ''} ${city ?? ''}`.trim())}`
}
