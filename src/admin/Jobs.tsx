import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useOrg } from '../auth/AuthProvider'
import { JobStatusBadge, ReadinessBadge, UrgentBadge } from '../components/StatusBadge'
import { Empty, Input, LinkButton, PageHeader, Spinner } from '../components/ui'
import { fmtDate, JOB_STATUS, type JobStatus } from '../lib/format'
import { supabase, type Tables } from '../lib/supabase'
import { useMembers, useRealtime } from './data'

type JobRow = Tables<'jobs'> & { job_visits: { assigned_to: string | null; visit_date: string; status: string }[] }

const FILTERS: { key: string; label: string; statuses: JobStatus[] }[] = [
  { key: 'open', label: 'Avoimet', statuses: ['draft', 'scheduled', 'in_progress', 'waiting'] },
  { key: 'draft', label: 'Delegoimatta', statuses: ['draft'] },
  { key: 'waiting', label: 'Odottaa', statuses: ['waiting'] },
  { key: 'done', label: 'Valmiit', statuses: ['done'] },
  { key: 'billable', label: 'Laskutettavissa', statuses: ['billable'] },
  { key: 'all', label: 'Kaikki', statuses: Object.keys(JOB_STATUS) as JobStatus[] },
]

export function Jobs() {
  const { orgId } = useOrg()
  const { members } = useMembers(orgId)
  const [params, setParams] = useSearchParams()
  const filter = FILTERS.find((f) => f.key === params.get('tila')) ?? FILTERS[0]
  const [jobs, setJobs] = useState<JobRow[] | null>(null)
  const [readiness, setReadiness] = useState<Map<string, string>>(new Map())
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*, job_visits(assigned_to, visit_date, status)')
      .eq('organization_id', orgId)
      .in('status', filter.statuses)
      .order('created_at', { ascending: false })
      .limit(300)
    const rows = (data ?? []) as JobRow[]
    setJobs(rows)
    if (rows.length) {
      const { data: r } = await supabase.from('job_readiness').select('job_id, readiness').in('job_id', rows.map((j) => j.id))
      setReadiness(new Map((r ?? []).map((x) => [x.job_id!, x.readiness!])))
    }
  }, [orgId, filter])

  useEffect(() => {
    void load()
  }, [load])
  useRealtime('jobs-list', ['jobs', 'job_visits'], load)

  const names = useMemo(() => new Map(members.map((m) => [m.user_id, m.full_name])), [members])
  const shown = (jobs ?? []).filter((j) => {
    const s = q.trim().toLowerCase()
    return !s || `${j.title} ${j.address} ${j.city} ${j.contact_name}`.toLowerCase().includes(s)
  })

  return (
    <div>
      <PageHeader
        title="Työt"
        actions={
          <LinkButton to="/hallinta/tyot/uusi" variant="primary">
            + Uusi työ
          </LinkButton>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setParams({ tila: f.key })}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${f.key === filter.key ? 'bg-ink text-white' : 'bg-white text-slate-700 border border-slate-300'}`}
          >
            {f.label}
          </button>
        ))}
        <Input className="ml-auto max-w-xs" placeholder="Hae…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!jobs ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <Empty title="Ei töitä" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Työ</th>
                <th className="px-3 py-2">Osoite</th>
                <th className="px-3 py-2">Asentaja / käynti</th>
                <th className="px-3 py-2">Tila</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((j) => {
                const visits = j.job_visits.filter((v) => v.status !== 'cancelled').sort((a, b) => (a.visit_date < b.visit_date ? 1 : -1))
                const v = visits[0]
                return (
                  <tr key={j.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link to={`/hallinta/tyot/${j.id}`} className="font-semibold text-ink hover:underline">
                        {j.title}
                      </Link>
                      <div className="text-xs text-slate-500">{j.contact_name}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {j.address}, {j.city}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{v ? `${names.get(v.assigned_to ?? '') ?? '–'} · ${fmtDate(v.visit_date)}` : <span className="text-amber-700">Delegoimatta</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <UrgentBadge priority={j.priority} />
                        <JobStatusBadge status={j.status} />
                        <ReadinessBadge readiness={readiness.get(j.id)} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
