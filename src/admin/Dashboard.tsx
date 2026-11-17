import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrg } from '../auth/AuthProvider'
import { JobMap, type MapJob, type MapPerson } from '../components/JobMap'
import { JobStatusBadge, ReadinessBadge, UrgentBadge } from '../components/StatusBadge'
import { Card, LinkButton, PageHeader, Spinner } from '../components/ui'
import { byVisitTime, fmtAge, fmtMinutes, isoDate, STALE_LOCATION_MIN, visitMinutes, visitRange } from '../lib/format'
import { supabase } from '../lib/supabase'
import { useMembers, useRealtime } from './data'

type VisitRow = {
  id: string
  assigned_to: string | null
  start_time: string | null
  duration_minutes: number | null
  sort: number
  status: string
  job: { id: string; title: string; address: string | null; city: string | null; lat: number | null; lng: number | null; status: string; priority: string; estimated_hours: number | null } | null
}

export function Dashboard() {
  const { orgId } = useOrg()
  const { installers } = useMembers(orgId)
  const [visits, setVisits] = useState<VisitRow[] | null>(null)
  const [people, setPeople] = useState<MapPerson[]>([])
  const [readiness, setReadiness] = useState<Map<string, string>>(new Map())
  const [times, setTimes] = useState<Map<string, { minutes: number; running: boolean }>>(new Map())
  const [kpi, setKpi] = useState({ newRequests: 0, waiting: 0, done: 0, extra: 0, unassigned: 0 })
  const today = isoDate()

  const load = useCallback(async () => {
    const [v, loc, prof, k1, k2, k3, k4, k5] = await Promise.all([
      supabase
        .from('job_visits')
        .select('id, assigned_to, start_time, duration_minutes, sort, status, job:jobs(id, title, address, city, lat, lng, status, priority, estimated_hours)')
        .eq('organization_id', orgId)
        .eq('visit_date', today)
        .neq('status', 'cancelled')
        .order('sort'),
      supabase.from('latest_locations').select('*').eq('organization_id', orgId),
      supabase.from('profiles').select('id, full_name, color'),
      supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'new'),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'waiting'),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'done'),
      supabase.from('job_extra_work').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pending'),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'draft'),
    ])
    const rows = ((v.data ?? []) as unknown as VisitRow[]).sort(byVisitTime)
    setVisits(rows)
    const pmap = new Map((prof.data ?? []).map((p) => [p.id, p]))
    setPeople(
      (loc.data ?? [])
        .filter((l) => l.lat !== null && l.lng !== null && l.recorded_at)
        .map((l) => ({
          user_id: l.user_id!,
          name: pmap.get(l.user_id!)?.full_name ?? '?',
          color: pmap.get(l.user_id!)?.color ?? '#0e7490',
          lat: l.lat!,
          lng: l.lng!,
          recorded_at: l.recorded_at!,
          shift_open: !!l.shift_open,
          accuracy: l.accuracy,
        }))
        // Päättyneen vuoron sijaintia ei näytetä kartalla.
        .filter((p) => p.shift_open),
    )
    setKpi({ newRequests: k1.count ?? 0, waiting: k2.count ?? 0, done: k3.count ?? 0, extra: k4.count ?? 0, unassigned: k5.count ?? 0 })
    const ids = rows.map((r) => r.job?.id).filter(Boolean) as string[]
    if (ids.length) {
      const [r, t] = await Promise.all([
        supabase.from('job_readiness').select('job_id, readiness').in('job_id', ids),
        supabase.from('job_time_totals').select('job_id, minutes, running').in('job_id', ids),
      ])
      setReadiness(new Map((r.data ?? []).map((x) => [x.job_id!, x.readiness!])))
      setTimes(new Map((t.data ?? []).map((x) => [x.job_id!, { minutes: Number(x.minutes ?? 0), running: !!x.running }])))
    }
  }, [orgId, today])

  useEffect(() => {
    void load()
    const i = setInterval(load, 60_000) // päivittää myös sijaintien iän
    return () => clearInterval(i)
  }, [load])
  useRealtime('dashboard', ['jobs', 'job_visits', 'location_pings', 'time_entries', 'material_picks'], load)

  if (!visits) return <Spinner />

  const mapJobs: MapJob[] = visits
    .filter((v) => v.job?.lat && v.job?.lng)
    .map((v) => ({
      id: v.job!.id,
      title: v.job!.title,
      address: v.job!.address,
      lat: v.job!.lat!,
      lng: v.job!.lng!,
      status: v.job!.status,
      assignee: installers.find((i) => i.user_id === v.assigned_to)?.full_name,
    }))

  const team = installers.filter((m) => m.role === 'installer' || visits.some((v) => v.assigned_to === m.user_id))
  const unassignedToday = visits.filter((v) => !v.assigned_to)

  return (
    <div>
      <PageHeader
        title="Tilannekuva"
        subtitle={new Date().toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={
          <>
            <LinkButton to="/hallinta/tyot/uusi" variant="primary">
              + Uusi työ
            </LinkButton>
            <LinkButton to="/hallinta/suunnittelu">Suunnittelu</LinkButton>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi to="/hallinta/pyynnot" label="Uudet pyynnöt" value={kpi.newRequests} />
        <Kpi to="/hallinta/suunnittelu" label="Delegoimatta" value={kpi.unassigned} tone={kpi.unassigned ? 'warn' : undefined} />
        <Kpi to="/hallinta/tyot?tila=waiting" label="Odottaa" value={kpi.waiting} tone={kpi.waiting ? 'warn' : undefined} />
        <Kpi to="/hallinta/laskutus" label="Lisätyöt hyväksyttävänä" value={kpi.extra} tone={kpi.extra ? 'warn' : undefined} />
        <Kpi to="/hallinta/laskutus" label="Valmiit tarkistettavana" value={kpi.done} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div>
          <JobMap jobs={mapJobs} people={people} jobLink={(id) => `/hallinta/tyot/${id}`} height={520} />
          <p className="mt-1 text-xs text-slate-500">
            Sijainnit näkyvät vain vuorossa olevilta asentajilta. Harmaa merkki = sijainti yli {STALE_LOCATION_MIN} min vanha.
          </p>
        </div>
        <div className="space-y-3">
          {team.map((m) => {
            const mine = visits.filter((v) => v.assigned_to === m.user_id)
            const done = mine.filter((v) => ['done', 'billable', 'invoiced'].includes(v.job?.status ?? '')).length
            const loc = people.find((p) => p.user_id === m.user_id)
            const stale = loc && Date.now() - new Date(loc.recorded_at).getTime() > STALE_LOCATION_MIN * 60000
            return (
              <Card key={m.user_id} className="p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: m.color }} />
                    <span className="font-bold">{m.full_name}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {done}/{mine.length} valmis ·{' '}
                    {loc ? <span className={stale ? 'text-amber-700' : 'text-emerald-700'}>📍 {fmtAge(loc.recorded_at)}</span> : 'ei vuorossa'}
                  </span>
                </div>
                {mine.length === 0 ? (
                  <p className="text-sm text-slate-400">Ei käyntejä tänään</p>
                ) : (
                  <ol className="space-y-1.5">
                    {mine.map((v) => (
                      <VisitLine key={v.id} v={v} readiness={readiness.get(v.job!.id)} time={times.get(v.job!.id)} />
                    ))}
                  </ol>
                )}
              </Card>
            )
          })}
          {unassignedToday.length > 0 && (
            <Card className="p-3">
              <p className="mb-2 font-bold text-amber-800">Ilman asentajaa</p>
              <ol className="space-y-1.5">
                {unassignedToday.map((v) => (
                  <VisitLine key={v.id} v={v} readiness={readiness.get(v.job!.id)} time={times.get(v.job!.id)} />
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function VisitLine({ v, readiness, time }: { v: VisitRow; readiness?: string; time?: { minutes: number; running: boolean } }) {
  if (!v.job) return null
  return (
    <li>
      <Link to={`/hallinta/tyot/${v.job.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-slate-50">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">
            {visitRange(v.start_time, visitMinutes(v.duration_minutes, v.job.estimated_hours)) && (
              <span className="mr-1.5 font-bold text-brand-700">{visitRange(v.start_time, visitMinutes(v.duration_minutes, v.job.estimated_hours))?.split('–')[0]}</span>
            )}
            {v.job.title}
          </span>
          <JobStatusBadge status={v.job.status} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span>{v.job.address}</span>
          <UrgentBadge priority={v.job.priority} />
          <ReadinessBadge readiness={readiness} />
          {time && time.minutes > 0 && <span>{time.running ? '⏱ ' : ''}{fmtMinutes(time.minutes)}</span>}
        </div>
      </Link>
    </li>
  )
}

function Kpi({ to, label, value, tone }: { to: string; label: string; value: number; tone?: 'warn' }) {
  return (
    <Link to={to} className={`rounded-2xl border bg-white p-3 shadow-sm hover:border-slate-400 ${tone === 'warn' ? 'border-amber-300' : 'border-slate-200'}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </Link>
  )
}
