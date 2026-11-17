import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ReportView } from '../components/ReportView'
import { Button, Card, ErrorBox, Input, Notice, Spinner, Stepper } from '../components/ui'
import { VoiceInput } from '../components/VoiceInput'
import { structureReport, type StructuredReport } from '../lib/ai'
import { errorMessage, fmtMinutes, uuid } from '../lib/format'
import { draftKey, flushOutbox, kvDel, kvGet, kvSet, outboxItems, runOrQueue } from '../lib/offline'
import { supabase, type Tables } from '../lib/supabase'
import { useInstaller } from './InstallerLayout'

type UsageRow = { key: string; job_material_id: string | null; product_id: string | null; description: string; unit: string; qty: number }
type Draft = { text: string; structured: StructuredReport | null }

/**
 * Työn valmistuminen yhdellä sivulla: kesto -> käytetyt tarvikkeet -> raportti -> vahvista.
 * Kaikki kirjaukset kulkevat lähetysjonon kautta, joten valmiiksi merkitseminen onnistuu myös
 * ilman verkkoa. Ilman tekoälyä raportti tallennetaan sellaisenaan.
 */
export function FinishJob() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { timer } = useInstaller()
  const [job, setJob] = useState<Tables<'jobs'> | null>(null)
  const [usage, setUsage] = useState<UsageRow[] | null>(null)
  const [minutes, setMinutes] = useState<number>(0)
  const [baseMinutes, setBaseMinutes] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [draft, setDraft] = useState<Draft>({ text: '', structured: null })
  const [aiBusy, setAiBusy] = useState(false)
  const [aiNote, setAiNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extraName, setExtraName] = useState('')

  const running = timer.active?.jobId === id

  useEffect(() => {
    void (async () => {
      const [j, m] = await Promise.all([
        supabase.from('jobs').select('*').eq('id', id!).maybeSingle(),
        supabase.from('job_material_status').select('*').eq('job_id', id!).order('description'),
      ])
      setJob(j.data)
      setUsage(
        (m.data ?? []).map((r) => ({
          key: r.id!,
          job_material_id: r.id,
          product_id: r.product_id,
          description: r.description ?? '',
          unit: r.unit ?? 'kpl',
          // Oletus: haettu määrä; jos mitään ei kirjattu haetuksi, tarve.
          qty: Number(r.qty_picked) > 0 ? Number(r.qty_picked) : Number(r.qty_needed),
        })),
      )
      const d = await kvGet<Draft>(draftKey(id!))
      if (d) setDraft(d)
    })()
  }, [id])

  // Kesto ehdotetaan ajanotosta; ilman ajanottoa työn arviosta.
  useEffect(() => {
    if (!job) return
    const m = running ? Math.max(1, Math.round(timer.elapsedMin)) : Math.round((Number(job.estimated_hours) || 1) * 60)
    const rounded = Math.max(15, Math.round(m / 15) * 15)
    setBaseMinutes(running ? Math.round(timer.elapsedMin) : rounded)
    setMinutes(running ? Math.round(timer.elapsedMin) : rounded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, running])

  useEffect(() => {
    if (id) void kvSet(draftKey(id), draft)
  }, [draft, id])

  const changed = minutes !== baseMinutes
  const canSave = !!draft.text.trim() && (!changed || !running || reason.trim().length > 0)

  const usagePayload = useMemo(
    () =>
      (usage ?? [])
        .filter((u) => u.qty > 0)
        .map((u) => ({ job_material_id: u.job_material_id, product_id: u.product_id, description: u.description, qty: u.qty, unit: u.unit })),
    [usage],
  )

  if (!job || !usage) return <Spinner />

  async function runAi() {
    setAiBusy(true)
    setAiNote(null)
    const r = await structureReport(draft.text, job!.title)
    setAiBusy(false)
    if (r.ok) setDraft((d) => ({ ...d, structured: r.data }))
    else setAiNote(`Raporttia ei muotoiltu (${r.reason}). Teksti tallennetaan sellaisenaan.`)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const jobId = job!.id
      const title = job!.title
      if (running) {
        await timer.stop(changed ? minutes : undefined, changed ? reason.trim() : undefined)
      } else {
        // Ei ajanottoa: kirjataan kesto jälkikäteen yhtenä merkintänä.
        const ev = uuid()
        const started = new Date(Date.now() - minutes * 60000).toISOString()
        await runOrQueue('start_work', { p_job_id: jobId, p_event_id: ev, p_started_at: started }, `Työaika: ${title}`)
        await runOrQueue('stop_work', { p_start_event_id: ev, p_ended_at: new Date().toISOString(), p_corrected_minutes: minutes, p_reason: 'Kirjattu käsin valmistumisen yhteydessä' }, `Työaika: ${title}`)
      }
      await runOrQueue('save_usage', { p_job_id: jobId, p_items: usagePayload }, `Tarvikkeet: ${title}`)
      await runOrQueue(
        'save_report',
        { p_job_id: jobId, p_raw_text: draft.text.trim(), p_structured: draft.structured, p_ai_used: !!draft.structured, p_confirm: true },
        `Raportti: ${title}`,
      )
      await runOrQueue('complete_job', { p_job_id: jobId }, `Valmis: ${title}`)
      await kvDel(draftKey(jobId))
      // Verkon ollessa päällä odotetaan, että jono on lähetetty, ennen kuin palataan listaan.
      await flushOutbox()
      const left = await outboxItems()
      if (left.some((i) => i.failed)) {
        setError('Osa kirjauksista ei mennyt läpi – katso ilmoitus sivun yläosassa.')
        return
      }
      navigate('/asentaja', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Link to={`/asentaja/tyo/${job.id}`} className="text-sm font-semibold text-brand-700">
        ← Takaisin
      </Link>
      <h1 className="text-2xl font-bold leading-tight">Valmis: {job.title}</h1>

      <Card>
        <h2 className="mb-2 font-bold">1. Työhön kulunut aika</h2>
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xl font-bold">{fmtMinutes(minutes)}</span>
          <div className="flex gap-2">
            <Button variant="secondary" className="tap w-16 text-lg" onClick={() => setMinutes((m) => Math.max(0, m - 15))}>
              −15
            </Button>
            <Button variant="secondary" className="tap w-16 text-lg" onClick={() => setMinutes((m) => m + 15)}>
              +15
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">{running ? `Ajanotto: ${fmtMinutes(baseMinutes)}` : 'Ajanotto ei ollut käynnissä – arvioi kesto.'}</p>
        {changed && running && (
          <Input className="mt-2" placeholder="Miksi kesto korjattiin? (pakollinen)" value={reason} onChange={(e) => setReason(e.target.value)} />
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-bold">2. Käytetyt tarvikkeet</h2>
        <ul className="space-y-3">
          {usage.map((u) => (
            <li key={u.key} className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 text-sm">
                {u.description} <span className="text-slate-500">({u.unit})</span>
              </span>
              <Stepper value={u.qty} onChange={(v) => setUsage((rows) => rows!.map((r) => (r.key === u.key ? { ...r, qty: v } : r)))} />
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!extraName.trim()) return
            setUsage((rows) => [...rows!, { key: uuid(), job_material_id: null, product_id: null, description: extraName.trim(), unit: 'kpl', qty: 1 }])
            setExtraName('')
          }}
        >
          <Input placeholder="Lisää muu tarvike" value={extraName} onChange={(e) => setExtraName(e.target.value)} />
          <Button type="submit" variant="secondary">
            Lisää
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-2 font-bold">3. Raportti</h2>
        <p className="mb-3 text-sm text-slate-600">Kerro mitä tehtiin, mitä tarvikkeita meni ja huomasitko jotain korjattavaa.</p>
        <VoiceInput
          value={draft.text}
          onChange={(t) => setDraft({ text: t, structured: null })}
          placeholder="Esim. vaihdettiin kolme pistorasiaa ja kattovalaisin, testattu toimii. Keittiön jakorasian kansi puuttui, laitettiin uusi."
        />
        <Button variant="secondary" className="tap mt-3 w-full" disabled={!draft.text.trim() || aiBusy} onClick={() => void runAi()}>
          {aiBusy ? 'Muotoillaan…' : '✨ Muotoile selkeäksi raportiksi'}
        </Button>
        {aiNote && <p className="mt-2 text-sm text-amber-800">{aiNote}</p>}
        {draft.structured && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-emerald-800">Esikatselu – tarkista ennen vahvistusta</p>
            <ReportView structured={draft.structured} />
          </div>
        )}
      </Card>

      <ErrorBox error={error} />
      {!draft.text.trim() && <Notice>Kirjoita tai sanele raportti ennen vahvistusta.</Notice>}
      <Button big variant="success" className="w-full" disabled={!canSave || saving} onClick={() => void save()}>
        {saving ? 'Tallennetaan…' : '✓ Vahvista ja merkitse valmiiksi'}
      </Button>
    </div>
  )
}
