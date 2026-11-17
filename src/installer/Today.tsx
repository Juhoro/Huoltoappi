import { Link } from 'react-router-dom'
import { useOrg } from '../auth/AuthProvider'
import { JobStatusBadge, ReadinessBadge, UrgentBadge } from '../components/StatusBadge'
import { Button, Empty, ErrorBox, Notice, Spinner } from '../components/ui'
import { addDays, fmtWeekday, isoDate, visitMinutes, visitRange } from '../lib/format'
import { mapsUrl, useMyVisits, type MyVisit } from './data'
import { useInstaller } from './InstallerLayout'

export function Today() {
  const { userId } = useOrg()
  const { visits, offline, error } = useMyVisits(userId)
  const { shift, timer } = useInstaller()
  const today = isoDate()

  if (error) return <ErrorBox error={error} />
  if (!visits) return <Spinner />

  const overdue = visits.filter((v) => v.visit_date < today)
  const todays = visits.filter((v) => v.visit_date === today)
  const tomorrow = visits.filter((v) => v.visit_date === addDays(today, 1))
  const later = visits.filter((v) => v.visit_date > addDays(today, 1))

  return (
    <div className="space-y-5">
      {!shift.loading && !shift.shiftOpen && (
        <Button big className="w-full" variant="success" onClick={() => void shift.start()}>
          Aloita päivä
        </Button>
      )}
      {timer.active && (
        <Link to={`/asentaja/tyo/${timer.active.jobId}`} className="block rounded-2xl bg-amber-100 p-4 text-amber-900">
          <p className="text-sm">Työ käynnissä · {timer.elapsedLabel}</p>
          <p className="text-lg font-bold">{timer.active.jobTitle}</p>
        </Link>
      )}
      {offline && <Notice tone="warn">Näytetään viimeksi ladattu työlista (ei verkkoyhteyttä).</Notice>}

      <Section title={`Tänään · ${fmtWeekday(today)}`} visits={todays} emptyText="Ei töitä tälle päivälle." />
      {overdue.length > 0 && <Section title="Keskeneräiset aiemmilta päiviltä" visits={overdue} />}
      {tomorrow.length > 0 && <Section title={`Huomenna · ${fmtWeekday(addDays(today, 1))}`} visits={tomorrow} muted />}
      {later.length > 0 && <Section title="Tulossa" visits={later} muted />}
    </div>
  )
}

function Section({ title, visits, emptyText, muted }: { title: string; visits: MyVisit[]; emptyText?: string; muted?: boolean }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      {visits.length === 0 ? (
        <Empty title={emptyText ?? 'Ei töitä'} />
      ) : (
        <ol className="space-y-3">
          {visits.map((v, i) => (
            <VisitCard key={v.id} v={v} n={i + 1} muted={muted} />
          ))}
        </ol>
      )}
    </section>
  )
}

function VisitCard({ v, n, muted }: { v: MyVisit; n: number; muted?: boolean }) {
  const j = v.job
  const range = visitRange(v.start_time, visitMinutes(v.duration_minutes, j.estimated_hours))
  const done = ['done', 'billable', 'invoiced'].includes(j.status)
  return (
    <li className={`rounded-2xl border bg-white shadow-sm ${done ? 'border-emerald-200 opacity-70' : 'border-slate-200'} ${muted ? 'opacity-80' : ''}`}>
      <Link to={`/asentaja/tyo/${j.id}`} className="block p-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-emerald-600 text-white' : 'bg-ink text-white'}`}>
            {done ? '✓' : n}
          </span>
          <div className="min-w-0 flex-1">
            {range && <p className="text-sm font-bold text-brand-700">klo {range}</p>}
            <p className="text-lg font-bold leading-tight">{j.title}</p>
            <p className="text-slate-600">
              {j.address}, {j.city}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <UrgentBadge priority={j.priority} />
              <JobStatusBadge status={j.status} />
              <ReadinessBadge readiness={v.readiness} />
            </div>
            {j.status === 'waiting' && j.waiting_reason && <p className="mt-1 text-sm text-rose-700">{j.waiting_reason}</p>}
          </div>
        </div>
      </Link>
      {!done && (
        <div className="grid grid-cols-2 border-t border-slate-100">
          <a href={mapsUrl(j.address, j.city)} target="_blank" rel="noreferrer" className="tap flex items-center justify-center gap-2 font-semibold text-brand-700">
            🧭 Navigoi
          </a>
          {j.contact_phone ? (
            <a href={`tel:${j.contact_phone.replace(/\s/g, '')}`} className="tap flex items-center justify-center gap-2 border-l border-slate-100 font-semibold text-brand-700">
              📞 Soita
            </a>
          ) : (
            <span className="tap border-l border-slate-100" />
          )}
        </div>
      )}
    </li>
  )
}
