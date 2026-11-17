import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useOrg } from '../auth/AuthProvider'
import { Attachments } from '../components/Attachments'
import { ReportView } from '../components/ReportView'
import { JobStatusBadge, ReadinessBadge, UrgentBadge } from '../components/StatusBadge'
import { Badge, Button, Card, ErrorBox, Input, Modal, Notice, Select, Spinner } from '../components/ui'
import { geocode } from '../lib/ai'
import { errorMessage, fmtDate, fmtDateTime, fmtMinutes, fmtQty, isoDate, JOB_STATUS, minToInput, timeToMin, visitMinutes, visitRange, type JobStatus } from '../lib/format'
import { supabase, type Tables, type Views } from '../lib/supabase'
import { useMembers, useProducts, useRealtime } from './data'
import { ProductSearch } from './ProductSearch'

type Visit = Omit<Tables<'job_visits'>, 'visit_duration'>

export function JobView() {
  const { id } = useParams<{ id: string }>()
  const { orgId } = useOrg()
  const { installers, members } = useMembers(orgId)
  const products = useProducts(orgId)
  const [job, setJob] = useState<Tables<'jobs'> | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [mats, setMats] = useState<Views<'job_material_status'>[]>([])
  const [usage, setUsage] = useState<Tables<'material_usage'>[]>([])
  const [times, setTimes] = useState<Tables<'time_entries'>[]>([])
  const [reports, setReports] = useState<Tables<'job_reports'>[]>([])
  const [extra, setExtra] = useState<Tables<'job_extra_work'>[]>([])
  const [events, setEvents] = useState<Tables<'job_status_events'>[]>([])
  const [readiness, setReadiness] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState<{ visitId?: string } | null>(null)
  const [correct, setCorrect] = useState<Tables<'time_entries'> | null>(null)

  const load = useCallback(async () => {
    const [j, v, m, u, t, r, x, e, rd] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', id!).maybeSingle(),
      supabase.from('job_visits').select('*').eq('job_id', id!).order('visit_date').order('start_time'),
      supabase.from('job_material_status').select('*').eq('job_id', id!).order('description'),
      supabase.from('material_usage').select('*').eq('job_id', id!),
      supabase.from('time_entries').select('*').eq('job_id', id!).order('started_at'),
      supabase.from('job_reports').select('*').eq('job_id', id!).order('version', { ascending: false }),
      supabase.from('job_extra_work').select('*').eq('job_id', id!).order('created_at'),
      supabase.from('job_status_events').select('*').eq('job_id', id!).order('created_at', { ascending: false }),
      supabase.from('job_readiness').select('readiness').eq('job_id', id!).maybeSingle(),
    ])
    if (!j.data) setError('Työtä ei löydy')
    setJob(j.data)
    setVisits(v.data ?? [])
    setMats(m.data ?? [])
    setUsage(u.data ?? [])
    setTimes(t.data ?? [])
    setReports(r.data ?? [])
    setExtra(x.data ?? [])
    setEvents(e.data ?? [])
    setReadiness(rd.data?.readiness ?? null)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])
  useRealtime(`job-${id}`, ['jobs', 'job_visits', 'material_picks', 'time_entries', 'job_reports'], load)

  if (error && !job) return <ErrorBox error={error} />
  if (!job) return <Spinner />

  const name = (uid: string | null) => members.find((m) => m.user_id === uid)?.full_name ?? '–'
  const totalMin = times.reduce((s, t) => s + (t.corrected_minutes ?? (t.ended_at ? (new Date(t.ended_at).getTime() - new Date(t.started_at).getTime()) / 60000 : 0)), 0)
  const unlinkedUsage = usage.filter((u) => !u.job_material_id)

  async function rpc(fn: () => PromiseLike<{ error: unknown }>) {
    setError(null)
    const { error } = await fn()
    if (error) setError(errorMessage(error))
    await load()
  }

  return (
    <div className="space-y-4">
      <Link to="/hallinta/tyot" className="text-sm font-semibold text-brand-700">
        ← Työt
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap gap-1.5">
            <UrgentBadge priority={job.priority} />
            <JobStatusBadge status={job.status} />
            <ReadinessBadge readiness={readiness} />
          </div>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <p className="text-slate-600">
            {job.address}, {job.city} · {job.contact_name} {job.contact_phone}
          </p>
          {job.quote_id && (
            <Link to={`/hallinta/tarjoukset/${job.quote_id}`} className="text-sm text-brand-700 underline">
              Tarjous
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {job.status === 'done' && (
            <Button variant="success" onClick={() => void rpc(() => supabase.rpc('approve_billing', { p_job_id: job.id }))}>
              Hyväksy laskutettavaksi
            </Button>
          )}
          {['done', 'waiting', 'billable'].includes(job.status) && (
            <Button
              variant="secondary"
              onClick={() => {
                const reason = prompt('Syy työn avaamiseen uudelleen?')
                if (reason) void rpc(() => supabase.rpc('reopen_job', { p_job_id: job.id, p_reason: reason }))
              }}
            >
              Avaa uudelleen
            </Button>
          )}
          {!job.lat && job.address && (
            <Button
              variant="secondary"
              onClick={async () => {
                const g = await geocode(job.address!, job.city ?? '')
                if (g.ok && g.data) await rpc(() => supabase.from('jobs').update({ lat: g.data!.lat, lng: g.data!.lng }).eq('id', job.id))
                else setError('Osoitetta ei löytynyt kartalta')
              }}
            >
              Paikanna kartalle
            </Button>
          )}
        </div>
      </div>

      <ErrorBox error={error} />
      {job.status === 'waiting' && <Notice tone="warn">Odottaa: {job.waiting_reason}</Notice>}
      {extra.some((x) => x.status === 'pending') && <Notice tone="warn">Työssä on lisätöitä odottamassa hyväksyntää.</Notice>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Käynnit</h2>
            <Button variant="secondary" onClick={() => setAssignOpen({})}>
              + Delegoi käynti
            </Button>
          </div>
          {visits.length === 0 ? (
            <p className="text-sm text-amber-700">Ei käyntejä – delegoi työ asentajalle.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visits.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className={v.status === 'cancelled' ? 'text-slate-400 line-through' : ''}>
                    {fmtDate(v.visit_date)}
                    {visitRange(v.start_time, visitMinutes(v.duration_minutes, job.estimated_hours)) && ` klo ${visitRange(v.start_time, visitMinutes(v.duration_minutes, job.estimated_hours))}`} · <b>{name(v.assigned_to)}</b> · {{ planned: 'suunniteltu', in_progress: 'käynnissä', done: 'tehty', cancelled: 'peruttu' }[v.status]}
                  </span>
                  {v.status === 'planned' && (
                    <span className="flex gap-1">
                      <Button variant="ghost" onClick={() => setAssignOpen({ visitId: v.id })}>
                        Vaihda
                      </Button>
                      <Button variant="ghost" onClick={() => void rpc(() => supabase.rpc('cancel_visit', { p_visit_id: v.id }))}>
                        Peru
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-bold">Työaika · {fmtMinutes(totalMin)}</h2>
          {times.length === 0 ? (
            <p className="text-sm text-slate-500">Ei aikakirjauksia.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {times.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {name(t.user_id)} · {fmtDateTime(t.started_at)}–{t.ended_at ? new Date(t.ended_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }) : 'käynnissä'}
                    {t.correction_reason && <span className="block text-xs text-amber-700">Korjattu: {t.correction_reason}</span>}
                  </span>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <b>{fmtMinutes(t.corrected_minutes ?? (t.ended_at ? (new Date(t.ended_at).getTime() - new Date(t.started_at).getTime()) / 60000 : null))}</b>
                    {t.ended_at && (
                      <Button variant="ghost" onClick={() => setCorrect(t)}>
                        Korjaa
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 font-bold">Tarvikkeet: tarve · haettu · käytetty</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1">Tuote</th>
                <th className="py-1 text-right">Tarve</th>
                <th className="py-1 text-right">Haettu</th>
                <th className="py-1 text-right">Käytetty</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mats.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="py-1.5">
                    {m.description} {m.missing && <Badge className="bg-rose-100 text-rose-800">puuttuu</Badge>}
                  </td>
                  <td className="py-1.5 text-right">
                    <input
                      className="w-16 rounded border border-slate-200 px-1 text-right"
                      defaultValue={String(m.qty_needed).replace('.', ',')}
                      onBlur={(e) => {
                        const n = Number(e.target.value.replace(',', '.'))
                        if (!Number.isNaN(n) && n !== Number(m.qty_needed)) void rpc(() => supabase.from('job_materials').update({ qty_needed: n }).eq('id', m.id!))
                      }}
                    />{' '}
                    {m.unit}
                  </td>
                  <td className={`py-1.5 text-right ${Number(m.qty_picked) >= Number(m.qty_needed) ? 'text-emerald-700' : ''}`}>{fmtQty(m.qty_picked)}</td>
                  <td className="py-1.5 text-right">{fmtQty(m.qty_used)}</td>
                  <td className="py-1.5 text-right">
                    {Number(m.qty_picked) === 0 && (
                      <button className="text-slate-400 hover:text-rose-600" title="Poista" onClick={() => void rpc(() => supabase.from('job_materials').delete().eq('id', m.id!))}>
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {unlinkedUsage.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 text-slate-600">
                  <td className="py-1.5">{u.description} <span className="text-xs">(lisätty kohteessa)</span></td>
                  <td className="py-1.5 text-right">–</td>
                  <td className="py-1.5 text-right">–</td>
                  <td className="py-1.5 text-right">
                    {fmtQty(u.qty)} {u.unit}
                  </td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!['billable', 'invoiced'].includes(job.status) && (
          <div className="mt-3">
            <ProductSearch
              products={products}
              onPick={(p) =>
                void rpc(() =>
                  supabase.from('job_materials').insert({ organization_id: orgId, job_id: job.id, product_id: p.id, description: p.name, unit: p.unit, qty_needed: 1 }),
                )
              }
            />
          </div>
        )}
      </Card>

      {extra.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold">Lisätyöt</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {extra.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {x.description} <span className="text-xs text-slate-500">– {name(x.created_by)}</span>
                </span>
                {x.status === 'pending' ? (
                  <span className="flex gap-1">
                    <Button variant="success" onClick={() => void rpc(() => supabase.rpc('decide_extra_work', { p_id: x.id, p_approve: true }))}>
                      Hyväksy
                    </Button>
                    <Button variant="secondary" onClick={() => void rpc(() => supabase.rpc('decide_extra_work', { p_id: x.id, p_approve: false }))}>
                      Hylkää
                    </Button>
                  </span>
                ) : (
                  <Badge className={x.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}>{x.status === 'approved' ? 'Hyväksytty' : 'Hylätty'}</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-bold">Raportti</h2>
          {reports.length === 0 ? (
            <p className="text-sm text-slate-500">Ei raporttia vielä.</p>
          ) : (
            reports.map((r, i) => (
              <details key={r.id} open={i === 0} className="border-t border-slate-100 py-2 first:border-0">
                <summary className="cursor-pointer text-xs text-slate-500">
                  Versio {r.version} · {name(r.created_by)} · {r.confirmed_at ? `vahvistettu ${fmtDateTime(r.confirmed_at)}` : 'luonnos'}
                  {r.ai_used ? ' · muotoiltu tekoälyllä' : ''}
                </summary>
                <div className="mt-2">
                  <ReportView structured={r.structured} raw={r.raw_text} />
                  {r.structured != null && (
                    <details className="mt-2 text-xs text-slate-500">
                      <summary className="cursor-pointer">Alkuperäinen sanelu</summary>
                      <p className="mt-1 whitespace-pre-wrap">{r.raw_text}</p>
                    </details>
                  )}
                </div>
              </details>
            ))
          )}
          <div className="mt-3">
            <Attachments orgId={orgId} jobId={job.id} canUpload />
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 font-bold">Kuvaus ja historia</h2>
          <p className="mb-3 whitespace-pre-wrap text-sm text-slate-700">{job.description || '–'}</p>
          <ul className="space-y-1 text-xs text-slate-600">
            {events.map((e) => (
              <li key={e.id}>
                <span className="text-slate-400">{fmtDateTime(e.created_at)}</span> · {name(e.actor)}:{' '}
                {e.from_status === e.to_status ? e.note : `${JOB_STATUS[e.to_status as JobStatus]?.label ?? e.to_status}${e.note ? ` – ${e.note}` : ''}`}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <AssignModal
        open={!!assignOpen}
        installers={installers}
        current={visits.find((v) => v.id === assignOpen?.visitId)}
        onClose={() => setAssignOpen(null)}
        onSave={async (userId, date, time) => {
          const visitId = assignOpen?.visitId
          setAssignOpen(null)
          await rpc(() =>
            supabase.rpc('assign_visit', { p_job_id: job.id, p_user_id: userId, p_date: date, p_visit_id: visitId, p_start_time: time || undefined }),
          )
        }}
      />
      <CorrectModal
        entry={correct}
        onClose={() => setCorrect(null)}
        onSave={async (min, reason) => {
          const e = correct!
          setCorrect(null)
          await rpc(() => supabase.rpc('correct_time', { p_entry_id: e.id, p_minutes: min, p_reason: reason }))
        }}
      />
    </div>
  )
}

function AssignModal({
  open,
  installers,
  current,
  onClose,
  onSave,
}: {
  open: boolean
  installers: { user_id: string; full_name: string }[]
  current?: Visit
  onClose: () => void
  onSave: (userId: string, date: string, time: string) => void
}) {
  const [userId, setUserId] = useState('')
  const [date, setDate] = useState(isoDate())
  const [time, setTime] = useState('')
  useEffect(() => {
    setUserId(current?.assigned_to ?? '')
    setDate(current?.visit_date ?? isoDate())
    const s = timeToMin(current?.start_time)
    setTime(s === null ? '' : minToInput(s))
  }, [current, open])
  return (
    <Modal open={open} onClose={onClose} title={current ? 'Vaihda asentaja tai päivä' : 'Delegoi käynti'}>
      <div className="space-y-3">
        <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Valitse asentaja</option>
          {installers.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Kellonaika" />
        </div>
        <p className="text-xs text-slate-500">Jos kellonaikaa ei anneta, käynti saa asentajan päivän seuraavan vapaan ajan.</p>
        <Button big className="w-full" disabled={!userId} onClick={() => onSave(userId, date, time)}>
          Tallenna
        </Button>
      </div>
    </Modal>
  )
}

function CorrectModal({ entry, onClose, onSave }: { entry: Tables<'time_entries'> | null; onClose: () => void; onSave: (min: number, reason: string) => void }) {
  const [min, setMin] = useState('')
  const [reason, setReason] = useState('')
  useEffect(() => {
    setMin(entry?.corrected_minutes ? String(entry.corrected_minutes) : '')
    setReason('')
  }, [entry])
  return (
    <Modal open={!!entry} onClose={onClose} title="Korjaa työaika">
      <div className="space-y-3">
        <Input inputMode="numeric" placeholder="Kesto minuutteina" value={min} onChange={(e) => setMin(e.target.value)} />
        <Input placeholder="Korjauksen syy (pakollinen)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button big className="w-full" disabled={!min || !reason.trim()} onClick={() => onSave(Number(min), reason.trim())}>
          Tallenna korjaus
        </Button>
      </div>
    </Modal>
  )
}
