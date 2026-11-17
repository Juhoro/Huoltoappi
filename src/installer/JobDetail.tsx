import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ReportView } from '../components/ReportView'
import { JobStatusBadge, UrgentBadge } from '../components/StatusBadge'
import { Button, Card, ErrorBox, Modal, Notice, Spinner, Textarea } from '../components/ui'
import { VoiceInput } from '../components/VoiceInput'
import { errorMessage, fmtDateTime, fmtQty, uuid } from '../lib/format'
import { runOrQueue } from '../lib/offline'
import { supabase, type Tables, type Views } from '../lib/supabase'
import { mapsUrl } from './data'
import { useInstaller } from './InstallerLayout'

const WAIT_REASONS = ['Osa puuttuu', 'Odottaa asiakkaan hyväksyntää', 'Tarvitaan jatkokäynti']

export function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { timer } = useInstaller()
  const [job, setJob] = useState<Tables<'jobs'> | null>(null)
  const [materials, setMaterials] = useState<Views<'job_material_status'>[]>([])
  const [reports, setReports] = useState<Tables<'job_reports'>[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [waitOpen, setWaitOpen] = useState(false)
  const [extraOpen, setExtraOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [j, m, r] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', id!).maybeSingle(),
      supabase.from('job_material_status').select('*').eq('job_id', id!).order('description'),
      supabase.from('job_reports').select('*').eq('job_id', id!).order('version', { ascending: false }),
    ])
    if (j.error) setError(errorMessage(j.error))
    else if (!j.data) setError('Työtä ei löydy tai sinulla ei ole siihen oikeutta.')
    setJob(j.data)
    setMaterials(m.data ?? [])
    setReports(r.data ?? [])
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <ErrorBox error={error} />
  if (!job) return <Spinner />

  const running = timer.active?.jobId === job.id
  const otherRunning = timer.active && !running
  const finished = ['done', 'billable', 'invoiced'].includes(job.status)

  async function act(fn: () => Promise<{ queued: boolean }>, okText: string) {
    setBusy(true)
    setError(null)
    try {
      const r = await fn()
      setNotice(r.queued ? `${okText} (tallennettu puhelimeen, lähetetään kun yhteys palaa)` : okText)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/asentaja" className="text-sm font-semibold text-brand-700">
        ← Takaisin
      </Link>
      <div>
        <div className="mb-1 flex flex-wrap gap-1.5">
          <UrgentBadge priority={job.priority} />
          <JobStatusBadge status={job.status} />
        </div>
        <h1 className="text-2xl font-bold leading-tight">{job.title}</h1>
        <p className="text-slate-600">
          {job.address}, {job.city}
        </p>
        {job.contact_name && <p className="text-slate-600">Yhteyshenkilö: {job.contact_name}</p>}
      </div>

      {notice && <Notice tone="ok">{notice}</Notice>}
      {job.status === 'waiting' && job.waiting_reason && <Notice tone="warn">Odottaa: {job.waiting_reason}</Notice>}

      <div className="grid grid-cols-2 gap-2">
        <a href={mapsUrl(job.address, job.city)} target="_blank" rel="noreferrer" className="tap flex items-center justify-center rounded-xl border border-slate-300 bg-white font-semibold">
          🧭 Navigoi
        </a>
        {job.contact_phone && (
          <a href={`tel:${job.contact_phone.replace(/\s/g, '')}`} className="tap flex items-center justify-center rounded-xl border border-slate-300 bg-white font-semibold">
            📞 {job.contact_phone}
          </a>
        )}
      </div>

      {!finished && (
        <div className="space-y-2">
          {!running ? (
            <Button
              big
              className="w-full"
              disabled={busy}
              onClick={() => act(() => timer.start(job.id, job.title), 'Työ aloitettu')}
            >
              ▶ Aloita työ
              {otherRunning ? ' (lopettaa toisen)' : ''}
            </Button>
          ) : (
            <div className="rounded-2xl bg-amber-100 p-4 text-center">
              <p className="text-sm text-amber-900">Työaika käynnissä</p>
              <p className="text-3xl font-bold text-amber-950">{timer.elapsedLabel}</p>
            </div>
          )}
          <Button big variant="success" className="w-full" onClick={() => navigate(`/asentaja/tyo/${job.id}/valmis`)}>
            ✓ Valmis – kirjaa ja raportoi
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="tap" onClick={() => setWaitOpen(true)}>
              Jää kesken
            </Button>
            <Button variant="secondary" className="tap" onClick={() => setExtraOpen(true)}>
              + Lisätyö
            </Button>
          </div>
        </div>
      )}

      <ErrorBox error={error} />

      {job.description && (
        <Card>
          <h2 className="mb-1 font-bold">Työn kuvaus</h2>
          <p className="whitespace-pre-wrap text-slate-700">{job.description}</p>
        </Card>
      )}

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">Tarvikkeet</h2>
          <Link to="/asentaja/tukku" className="text-sm font-semibold text-brand-700">
            Keräilylistaan →
          </Link>
        </div>
        {materials.length === 0 ? (
          <p className="text-sm text-slate-500">Ei tarvikkeita kirjattu.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {materials.map((m) => {
              const ok = Number(m.qty_picked) >= Number(m.qty_needed)
              return (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <span className={m.missing ? 'text-rose-700' : ''}>
                    {m.description}
                    {m.missing && ' · puuttuu'}
                  </span>
                  <span className={`whitespace-nowrap text-sm font-semibold ${ok ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {fmtQty(m.qty_picked)} / {fmtQty(m.qty_needed)} {m.unit} {ok && '✓'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {reports.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold">Raportit</h2>
          {reports.map((r) => (
            <div key={r.id} className="border-t border-slate-100 py-2 first:border-0">
              <p className="mb-1 text-xs text-slate-500">
                Versio {r.version} · {r.confirmed_at ? `vahvistettu ${fmtDateTime(r.confirmed_at)}` : 'luonnos'}
              </p>
              <ReportView structured={r.structured} raw={r.raw_text} />
            </div>
          ))}
        </Card>
      )}

      <WaitModal
        open={waitOpen}
        onClose={() => setWaitOpen(false)}
        onSubmit={async (reason) => {
          setWaitOpen(false)
          if (running) await timer.stop()
          await act(() => runOrQueue('set_job_waiting', { p_job_id: job.id, p_reason: reason }, `Kesken: ${job.title}`), 'Työ merkitty keskeneräiseksi')
        }}
      />
      <ExtraWorkModal
        open={extraOpen}
        onClose={() => setExtraOpen(false)}
        onSubmit={async (text) => {
          setExtraOpen(false)
          await act(
            () => runOrQueue('add_extra_work', { p_job_id: job.id, p_event_id: uuid(), p_description: text }, `Lisätyö: ${job.title}`),
            'Lisätyö kirjattu työnjohdon hyväksyttäväksi',
          )
        }}
      />
    </div>
  )
}

function WaitModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState(WAIT_REASONS[0])
  const [detail, setDetail] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Miksi työ jää kesken?">
      <div className="space-y-2">
        {WAIT_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`tap w-full rounded-xl border px-4 text-left font-semibold ${reason === r ? 'border-ink bg-ink text-white' : 'border-slate-300 bg-white'}`}
          >
            {r}
          </button>
        ))}
        <Textarea rows={2} placeholder="Tarkenna (esim. mikä osa puuttuu)" value={detail} onChange={(e) => setDetail(e.target.value)} />
        <Button big className="w-full" onClick={() => onSubmit(detail.trim() ? `${reason}: ${detail.trim()}` : reason)}>
          Merkitse keskeneräiseksi
        </Button>
      </div>
    </Modal>
  )
}

function ExtraWorkModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Lisätyö">
      <p className="mb-3 text-sm text-slate-600">Kerro mitä lisätyötä kohteessa tarvitaan. Työnjohto hyväksyy sen ennen laskutusta.</p>
      <VoiceInput value={text} onChange={setText} rows={3} big={false} placeholder="Esim. kylpyhuoneen kattovalaisimen kupu haljennut, vaihdettava" />
      <Button
        big
        className="mt-3 w-full"
        disabled={!text.trim()}
        onClick={() => {
          onSubmit(text.trim())
          setText('')
        }}
      >
        Lähetä hyväksyttäväksi
      </Button>
    </Modal>
  )
}
