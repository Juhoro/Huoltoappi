import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrg } from '../auth/AuthProvider'
import { JobStatusBadge, UrgentBadge } from '../components/StatusBadge'
import { Button, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner } from '../components/ui'
import {
  addDays,
  byVisitTime,
  errorMessage,
  fmtDate,
  fmtWeekday,
  isoDate,
  minToInput,
  mondayOf,
  overlappingIds,
  timeToMin,
  visitMinutes,
  visitRange,
} from '../lib/format'
import { supabase } from '../lib/supabase'
import { useMembers, useRealtime, type Member } from './data'

type Visit = {
  id: string
  job_id: string
  assigned_to: string | null
  visit_date: string
  start_time: string | null
  duration_minutes: number | null
  sort: number
  status: string
  job: { title: string; status: string; priority: string; city: string | null; estimated_hours: number | null } | null
}
type OpenJob = { id: string; title: string; status: string; priority: string; city: string | null; waiting_reason: string | null; estimated_hours: number | null }

type Dragged = { kind: 'job'; jobId: string } | { kind: 'visit'; visitId: string; jobId: string }

const DURATIONS = [30, 60, 90, 120, 180, 240, 300, 360, 480]
const durLabel = (m: number) => (m < 60 ? `${m} min` : `${(m / 60).toString().replace('.', ',')} h`)
const minutesOf = (v: Visit) => visitMinutes(v.duration_minutes, v.job?.estimated_hours)

/**
 * Viikkosuunnittelu kellonajoilla. Vedä työ asentajan päivälle (saa seuraavan vapaan ajan),
 * napsauta käyntiä muuttaaksesi aikaa/kestoa. Kosketusnäytöllä: valitse työ ja napauta solua.
 */
export function Planner() {
  const { orgId } = useOrg()
  const { installers } = useMembers(orgId)
  const [week, setWeek] = useState(mondayOf(isoDate()))
  const [visits, setVisits] = useState<Visit[] | null>(null)
  const [open, setOpen] = useState<OpenJob[]>([])
  const [selected, setSelected] = useState<Dragged | null>(null)
  const [editing, setEditing] = useState<Visit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const days = Array.from({ length: 6 }, (_, i) => addDays(week, i)) // ma–la

  const load = useCallback(async () => {
    const [v, j] = await Promise.all([
      supabase
        .from('job_visits')
        .select('id, job_id, assigned_to, visit_date, start_time, duration_minutes, sort, status, job:jobs(title, status, priority, city, estimated_hours)')
        .eq('organization_id', orgId)
        .gte('visit_date', week)
        .lte('visit_date', addDays(week, 6))
        .neq('status', 'cancelled'),
      supabase
        .from('jobs')
        .select('id, title, status, priority, city, waiting_reason, estimated_hours, job_visits(status, visit_date)')
        .eq('organization_id', orgId)
        .in('status', ['draft', 'waiting', 'scheduled']),
    ])
    setVisits((v.data ?? []) as unknown as Visit[])
    const today = isoDate()
    // Suunnittelematta: luonnokset, odottavat ja työt joilla ei ole tulevaa käyntiä.
    setOpen(
      ((j.data ?? []) as (OpenJob & { job_visits: { status: string; visit_date: string }[] })[])
        .filter((x) => x.status !== 'scheduled' || !x.job_visits.some((jv) => jv.status === 'planned' && jv.visit_date >= today))
        .sort((a, b) => (a.priority === 'urgent' ? -1 : 0) - (b.priority === 'urgent' ? -1 : 0)),
    )
  }, [orgId, week])

  useEffect(() => {
    void load()
  }, [load])
  useRealtime('planner', ['jobs', 'job_visits'], load)

  async function call(p: PromiseLike<{ error: unknown }>) {
    setError(null)
    const { error } = await p
    if (error) setError(errorMessage(error))
    await load()
  }

  async function drop(target: { userId: string; date: string }, d: Dragged | null) {
    if (!d) return
    setSelected(null)
    await call(
      supabase.rpc('assign_visit', {
        p_job_id: d.jobId,
        p_user_id: target.userId,
        p_date: target.date,
        p_visit_id: d.kind === 'visit' ? d.visitId : undefined,
      }),
    )
  }

  const parse = (e: React.DragEvent): Dragged | null => {
    try {
      return JSON.parse(e.dataTransfer.getData('application/json'))
    } catch {
      return null
    }
  }

  if (!visits) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Suunnittelu"
        subtitle="Vedä työ asentajan päivälle – se saa seuraavan vapaan ajan. Napsauta käyntiä muuttaaksesi kellonaikaa."
        actions={
          <>
            <Button variant="secondary" onClick={() => setWeek(addDays(week, -7))}>
              ← Ed. viikko
            </Button>
            <Button variant="secondary" onClick={() => setWeek(mondayOf(isoDate()))}>
              Tämä viikko
            </Button>
            <Button variant="secondary" onClick={() => setWeek(addDays(week, 7))}>
              Seur. viikko →
            </Button>
          </>
        }
      />
      <ErrorBox error={error} />
      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase text-slate-500">Suunnittelematta ({open.length})</h2>
          <ul className="space-y-2">
            {open.map((j) => {
              const isSel = selected?.kind === 'job' && selected.jobId === j.id
              return (
                <li
                  key={j.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'job', jobId: j.id }))}
                  onClick={() => setSelected(isSel ? null : { kind: 'job', jobId: j.id })}
                  className={`cursor-grab rounded-xl border bg-white p-2 text-sm shadow-sm ${isSel ? 'border-ink ring-2 ring-ink' : 'border-slate-200'}`}
                >
                  <p className="font-semibold">{j.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                    {j.city}
                    {j.estimated_hours ? ` · arvio ${durLabel(Math.round(Number(j.estimated_hours) * 60))}` : ''}
                    <UrgentBadge priority={j.priority} />
                    <JobStatusBadge status={j.status} />
                  </div>
                  {j.waiting_reason && <p className="mt-1 text-xs text-rose-700">{j.waiting_reason}</p>}
                </li>
              )
            })}
            {open.length === 0 && <li className="text-sm text-slate-400">Kaikki työt on suunniteltu 👍</li>}
          </ul>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] table-fixed border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="w-32" />
                {days.map((d) => (
                  <th key={d} className={`rounded-lg py-1 text-xs font-semibold ${d === isoDate() ? 'bg-ink text-white' : 'text-slate-600'}`}>
                    {fmtWeekday(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {installers.map((m) => (
                <tr key={m.user_id}>
                  <td className="align-top">
                    <div className="flex items-center gap-1.5 py-2 font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                      {m.full_name}
                    </div>
                  </td>
                  {days.map((d) => {
                    const cell = visits.filter((v) => v.assigned_to === m.user_id && v.visit_date === d).sort(byVisitTime)
                    const overlaps = overlappingIds(cell.map((v) => ({ id: v.id, start: timeToMin(v.start_time), minutes: minutesOf(v) })))
                    const total = cell.reduce((s, v) => s + minutesOf(v), 0)
                    return (
                      <td
                        key={d}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          void drop({ userId: m.user_id, date: d }, parse(e))
                        }}
                        onClick={() => selected && void drop({ userId: m.user_id, date: d }, selected)}
                        className={`h-24 rounded-lg align-top ${selected ? 'cursor-pointer bg-sky-50 hover:bg-sky-100' : 'bg-slate-100'}`}
                      >
                        <div className="space-y-1 p-1">
                          {cell.map((v) => {
                            const range = visitRange(v.start_time, minutesOf(v))
                            const overlap = overlaps.has(v.id)
                            return (
                              <div
                                key={v.id}
                                draggable={v.status === 'planned'}
                                onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'visit', visitId: v.id, jobId: v.job_id }))}
                                onClick={(e) => {
                                  if (selected) return
                                  e.stopPropagation()
                                  setEditing(v)
                                }}
                                className={`cursor-pointer rounded-md border bg-white px-1.5 py-1 text-xs shadow-sm hover:border-slate-400 ${v.status === 'done' ? 'opacity-50' : ''} ${
                                  selected?.kind === 'visit' && selected.visitId === v.id ? 'ring-2 ring-ink' : ''
                                } ${overlap ? 'border-amber-500 bg-amber-50' : v.job?.priority === 'urgent' ? 'border-rose-400' : 'border-slate-200'}`}
                              >
                                <p className={`font-bold ${range ? 'text-brand-700' : 'text-slate-400'}`}>
                                  {range ?? 'ei kellonaikaa'}
                                  {overlap && <span className="ml-1 text-amber-700">⚠</span>}
                                </p>
                                <p className="font-semibold leading-tight">{v.job?.title}</p>
                                <p className="text-slate-500">
                                  {v.job?.city} {v.status === 'done' ? '✓' : ''}
                                </p>
                              </div>
                            )
                          })}
                          {total > 0 && (
                            <p className={`px-1 text-right text-[11px] font-semibold ${total > 8 * 60 ? 'text-rose-700' : 'text-slate-500'}`}>
                              yht. {durLabel(total)}
                              {overlaps.size > 0 && <span className="block text-amber-700">päällekkäisiä aikoja</span>}
                            </p>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {selected && (
            <p className="mt-2 text-sm text-sky-800">
              Valittu – napauta solua siirtääksesi.{' '}
              <button className="underline" onClick={() => setSelected(null)}>
                Peru
              </button>
            </p>
          )}
        </div>
      </div>

      <VisitModal
        visit={editing}
        installers={installers}
        onClose={() => setEditing(null)}
        onSave={async (v, f) => {
          setEditing(null)
          if (f.userId !== v.assigned_to || f.date !== v.visit_date) {
            await call(supabase.rpc('assign_visit', { p_job_id: v.job_id, p_user_id: f.userId, p_date: f.date, p_visit_id: v.id }))
          }
          await call(supabase.rpc('set_visit_time', { p_visit_id: v.id, p_start_time: (f.time || null) as string, p_duration_minutes: (f.duration ?? null) as number }))
        }}
        onMove={(v) => {
          setEditing(null)
          setSelected({ kind: 'visit', visitId: v.id, jobId: v.job_id })
        }}
        onCancel={async (v) => {
          setEditing(null)
          if (confirm('Perutaanko käynti?')) await call(supabase.rpc('cancel_visit', { p_visit_id: v.id }))
        }}
      />
    </div>
  )
}

function VisitModal({
  visit,
  installers,
  onClose,
  onSave,
  onMove,
  onCancel,
}: {
  visit: Visit | null
  installers: Member[]
  onClose: () => void
  onSave: (v: Visit, f: { userId: string; date: string; time: string; duration: number | null }) => void
  onMove: (v: Visit) => void
  onCancel: (v: Visit) => void
}) {
  const [userId, setUserId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState<number | null>(null)

  useEffect(() => {
    if (!visit) return
    setUserId(visit.assigned_to ?? '')
    setDate(visit.visit_date)
    const s = timeToMin(visit.start_time)
    setTime(s === null ? '' : minToInput(s))
    setDuration(visit.duration_minutes)
  }, [visit])

  if (!visit) return null
  const estimate = visitMinutes(null, visit.job?.estimated_hours)
  const editable = visit.status === 'planned'

  return (
    <Modal open onClose={onClose} title={visit.job?.title ?? 'Käynti'}>
      <div className="space-y-3">
        {!editable && <p className="text-sm text-slate-500">Käynti on jo aloitettu tai tehty – aikaa voi muuttaa, mutta ei siirtää.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Alkaa klo">
            <Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Kesto">
            <Select value={duration ?? ''} onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Työn arvio ({durLabel(estimate)})</option>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {durLabel(d)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Asentaja">
            <Select value={userId} onChange={(e) => setUserId(e.target.value)} disabled={!editable}>
              {installers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Päivä">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!editable} />
          </Field>
        </div>
        {time && (
          <p className="text-sm text-slate-600">
            {fmtDate(date)} klo {visitRange(time, duration ?? estimate)}
          </p>
        )}
        <Button big className="w-full" disabled={!userId || !date} onClick={() => onSave(visit, { userId, date, time, duration })}>
          Tallenna
        </Button>
        <div className="flex flex-wrap justify-between gap-2">
          <Link to={`/hallinta/tyot/${visit.job_id}`} className="px-1 py-2 text-sm font-semibold text-brand-700">
            Avaa työ →
          </Link>
          {editable && (
            <span className="flex gap-2">
              <Button variant="secondary" onClick={() => onMove(visit)}>
                Siirrä napauttamalla
              </Button>
              <Button variant="ghost" onClick={() => onCancel(visit)}>
                Peru käynti
              </Button>
            </span>
          )}
        </div>
      </div>
    </Modal>
  )
}
