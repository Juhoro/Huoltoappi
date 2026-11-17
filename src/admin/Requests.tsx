import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOrg } from '../auth/AuthProvider'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, Notice, PageHeader, Spinner } from '../components/ui'
import { VoiceInput } from '../components/VoiceInput'
import { parseRequest } from '../lib/ai'
import { errorMessage, fmtDateTime, fmtEur, QUOTE_STATUS, REQUEST_STATUS, SOURCE_LABEL } from '../lib/format'
import { supabase, type Tables } from '../lib/supabase'
import { useRealtime } from './data'

type QuoteRow = Tables<'quotes'> & { customers: { name: string } | null; quote_lines: { qty: number; unit_price: number }[] }

export function Requests() {
  const { orgId, org } = useOrg()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<Tables<'quote_requests'>[] | null>(null)
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [showClosed, setShowClosed] = useState(false)
  const [newOpen, setNewOpen] = useState(false)

  const load = useCallback(async () => {
    const [r, q] = await Promise.all([
      supabase.from('quote_requests').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(200),
      supabase
        .from('quotes')
        .select('*, customers(name), quote_lines(qty, unit_price)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    setRequests(r.data ?? [])
    setQuotes((q.data ?? []) as unknown as QuoteRow[])
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])
  useRealtime('requests', ['quote_requests', 'quotes'], load)

  if (!requests) return <Spinner />
  const shown = requests.filter((r) => showClosed || ['new', 'in_progress'].includes(r.status))
  const openQuotes = quotes.filter((q) => showClosed || ['draft', 'sent'].includes(q.status))
  const formUrl = `${location.origin}/pyynto/${org.slug}`

  return (
    <div>
      <PageHeader
        title="Pyynnöt ja tarjoukset"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowClosed(!showClosed)}>
              {showClosed ? 'Piilota käsitellyt' : 'Näytä käsitellyt'}
            </Button>
            <Button onClick={() => setNewOpen(true)}>+ Uusi pyyntö</Button>
          </>
        }
      />
      <Notice>
        Julkinen tarjouspyyntölomake nettisivuillesi:{' '}
        <a href={formUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
          {formUrl}
        </a>
      </Notice>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section>
          <h2 className="mb-2 font-bold">Tarjouspyynnöt</h2>
          {shown.length === 0 ? (
            <Empty title="Ei avoimia pyyntöjä" />
          ) : (
            <ul className="space-y-2">
              {shown.map((r) => (
                <li key={r.id}>
                  <Link to={`/hallinta/pyynnot/${r.id}`} className="block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-400">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{r.contact_name}</span>
                      <span className="flex gap-1">
                        {r.urgent && <Badge className="bg-rose-600 text-white">Kiire</Badge>}
                        <Badge className={REQUEST_STATUS[r.status].cls}>{REQUEST_STATUS[r.status].label}</Badge>
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-slate-600">{r.description}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {SOURCE_LABEL[r.source]} · {fmtDateTime(r.created_at)} · {r.city}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-2 font-bold">Tarjoukset</h2>
          {openQuotes.length === 0 ? (
            <Empty title="Ei avoimia tarjouksia" />
          ) : (
            <ul className="space-y-2">
              {openQuotes.map((q) => (
                <li key={q.id}>
                  <Link to={`/hallinta/tarjoukset/${q.id}`} className="block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-400">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{q.title}</span>
                      <Badge className={QUOTE_STATUS[q.status].cls}>{QUOTE_STATUS[q.status].label}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                      {q.customers?.name} · {fmtEur(q.quote_lines.reduce((s, l) => s + Number(l.qty) * Number(l.unit_price), 0))} alv 0 %
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <NewRequestModal
        open={newOpen}
        orgId={orgId}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          setNewOpen(false)
          navigate(`/hallinta/pyynnot/${id}`)
        }}
      />
    </div>
  )
}

/** Uusi pyyntö puhelun aikana: sanele tai kirjoita, tekoäly poimii kentät (valinnainen). */
function NewRequestModal({ open, orgId, onClose, onCreated }: { open: boolean; orgId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const empty = { contact_name: '', phone: '', email: '', address: '', city: '', description: '', urgent: false }
  const [f, setF] = useState(empty)
  const [dictation, setDictation] = useState('')
  const [uncertain, setUncertain] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function extract() {
    setBusy(true)
    setNote(null)
    const r = await parseRequest(dictation)
    setBusy(false)
    if (!r.ok) {
      setNote(`Kenttiä ei poimittu automaattisesti (${r.reason}). Täytä ne käsin – sanelu on kopioitu kuvaukseen.`)
      setF((x) => ({ ...x, description: x.description || dictation }))
      return
    }
    const d = r.data
    setF({ contact_name: d.contact_name, phone: d.phone, email: d.email, address: d.address, city: d.city, description: d.description || dictation, urgent: d.urgent })
    setUncertain(d.uncertain_fields)
  }

  async function save() {
    setError(null)
    const { data, error } = await supabase
      .from('quote_requests')
      .insert({ organization_id: orgId, ...f, source: dictation ? 'voice' : 'phone' })
      .select('id')
      .single()
    if (error) setError(errorMessage(error))
    else {
      setF(empty)
      setDictation('')
      setUncertain([])
      onCreated(data.id)
    }
  }

  const hl = (k: string) => (uncertain.includes(k) ? 'border-amber-400 bg-amber-50' : '')
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  return (
    <Modal open={open} onClose={onClose} title="Uusi tarjouspyyntö">
      <div className="space-y-3">
        <VoiceInput value={dictation} onChange={setDictation} rows={3} big={false} placeholder="Sanele puhelun tiedot: nimi, numero, osoite ja mitä tarvitaan" />
        <Button variant="secondary" className="w-full" disabled={!dictation.trim() || busy} onClick={() => void extract()}>
          {busy ? 'Poimitaan…' : '✨ Poimi kentät sanelusta'}
        </Button>
        {note && <p className="text-sm text-amber-800">{note}</p>}
        {uncertain.length > 0 && <p className="text-xs text-amber-800">Keltaiset kentät ovat epävarmoja – tarkista.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Nimi *">
            <Input className={hl('contact_name')} value={f.contact_name} onChange={set('contact_name')} />
          </Field>
          <Field label="Puhelin">
            <Input className={hl('phone')} value={f.phone} onChange={set('phone')} />
          </Field>
          <Field label="Osoite">
            <Input className={hl('address')} value={f.address} onChange={set('address')} />
          </Field>
          <Field label="Kaupunki">
            <Input className={hl('city')} value={f.city} onChange={set('city')} />
          </Field>
        </div>
        <Field label="Sähköposti">
          <Input className={hl('email')} value={f.email} onChange={set('email')} />
        </Field>
        <Field label="Kuvaus *">
          <textarea className={`w-full rounded-xl border border-slate-300 px-3 py-2 ${hl('description')}`} rows={3} value={f.description} onChange={set('description')} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.urgent} onChange={(e) => setF({ ...f, urgent: e.target.checked })} /> Kiireellinen
        </label>
        <ErrorBox error={error} />
        <Button big className="w-full" disabled={!f.contact_name.trim() || !f.description.trim()} onClick={() => void save()}>
          Tallenna pyyntö
        </Button>
      </div>
    </Modal>
  )
}

export function RequestView() {
  const { id } = useParams<{ id: string }>()
  const { orgId } = useOrg()
  const navigate = useNavigate()
  const [r, setR] = useState<Tables<'quote_requests'> | null>(null)
  const [quotes, setQuotes] = useState<Tables<'quotes'>[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([
      supabase.from('quote_requests').select('*').eq('id', id!).maybeSingle(),
      supabase.from('quotes').select('*').eq('quote_request_id', id!),
    ]).then(([a, b]) => {
      setR(a.data)
      setQuotes(b.data ?? [])
    })
  }, [id])

  if (!r) return <Spinner />

  /** Asiakas luodaan pyynnön tiedoista, jos sitä ei vielä ole. */
  async function ensureCustomer(): Promise<string> {
    if (r!.customer_id) return r!.customer_id
    const { data, error } = await supabase
      .from('customers')
      .insert({ organization_id: orgId, name: r!.contact_name, phone: r!.phone, email: r!.email, address: r!.address, city: r!.city })
      .select('id')
      .single()
    if (error) throw error
    await supabase.from('quote_requests').update({ customer_id: data.id }).eq('id', r!.id)
    return data.id
  }

  async function makeQuote() {
    try {
      const customerId = await ensureCustomer()
      const { data, error } = await supabase
        .from('quotes')
        .insert({
          organization_id: orgId,
          quote_request_id: r!.id,
          customer_id: customerId,
          title: r!.description.split(/[.!?\n]/)[0].slice(0, 80),
          description: r!.description,
          address: r!.address,
          city: r!.city,
          valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        })
        .select('id')
        .single()
      if (error) throw error
      await supabase.from('quote_requests').update({ status: 'in_progress' }).eq('id', r!.id)
      navigate(`/hallinta/tarjoukset/${data.id}`)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function setStatus(status: string) {
    await supabase.from('quote_requests').update({ status }).eq('id', r!.id)
    setR({ ...r!, status })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/hallinta/pyynnot" className="text-sm font-semibold text-brand-700">
        ← Pyynnöt
      </Link>
      <PageHeader
        title={r.contact_name}
        subtitle={`${SOURCE_LABEL[r.source]} · ${fmtDateTime(r.created_at)}`}
        actions={<Badge className={REQUEST_STATUS[r.status].cls}>{REQUEST_STATUS[r.status].label}</Badge>}
      />
      <Card className="space-y-2">
        <p className="whitespace-pre-wrap">{r.description}</p>
        <p className="text-sm text-slate-600">
          {r.address}, {r.city}
          <br />
          {r.phone} {r.email}
        </p>
      </Card>
      <ErrorBox error={error} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void makeQuote()}>Tee tarjous</Button>
        <Button variant="secondary" onClick={() => navigate('/hallinta/tyot/uusi', { state: { request: r } })}>
          Luo työ suoraan (ilman tarjousta)
        </Button>
        {r.status !== 'rejected' && (
          <Button variant="ghost" onClick={() => void setStatus('rejected')}>
            Hylkää
          </Button>
        )}
      </div>
      {quotes.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold">Tarjoukset</h2>
          {quotes.map((q) => (
            <Link key={q.id} to={`/hallinta/tarjoukset/${q.id}`} className="block py-1 text-brand-700 underline">
              {q.title} – {QUOTE_STATUS[q.status].label}
            </Link>
          ))}
        </Card>
      )}
    </div>
  )
}
