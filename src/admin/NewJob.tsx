import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useOrg } from '../auth/AuthProvider'
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Stepper } from '../components/ui'
import { VoiceInput } from '../components/VoiceInput'
import { geocode } from '../lib/ai'
import { errorMessage, isoDate, uuid } from '../lib/format'
import { supabase, type Tables } from '../lib/supabase'
import { useMembers, useProducts } from './data'
import { ProductSearch } from './ProductSearch'

type Line = { product_id: string | null; description: string; unit: string; qty: number }

/**
 * Suora työn luonti (esim. kiireellinen vikakeikka) ilman tarjousta. Lomakkeen event_id
 * pysyy samana, joten tuplaklikkaus tai uudelleenyritys ei luo kahta työtä.
 */
export function NewJob() {
  const { orgId } = useOrg()
  const navigate = useNavigate()
  const prefill = (useLocation().state as { request?: Tables<'quote_requests'> } | null)?.request
  const { installers } = useMembers(orgId)
  const products = useProducts(orgId)
  const eventId = useMemo(() => uuid(), [])

  const [f, setF] = useState({
    title: '',
    description: prefill?.description ?? '',
    customer_name: prefill?.contact_name ?? '',
    address: prefill?.address ?? '',
    city: prefill?.city ?? '',
    contact_phone: prefill?.phone ?? '',
    priority: prefill?.urgent ? 'urgent' : 'normal',
    estimated_hours: '',
    assigned_to: '',
    visit_date: isoDate(),
    start_time: '',
  })
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    // Geokoodaus on lisäominaisuus: ilman sitä työ ei vain näy kartalla.
    const geo = f.address ? await geocode(f.address, f.city) : null
    const coords = geo && geo.ok && geo.data ? geo.data : null
    const { data, error } = await supabase.rpc('create_direct_job', {
      p_org: orgId,
      p_event_id: eventId,
      p_title: f.title,
      p_description: f.description,
      p_customer_name: f.customer_name || undefined,
      p_address: f.address || undefined,
      p_city: f.city || undefined,
      p_contact_name: f.customer_name || undefined,
      p_contact_phone: f.contact_phone || undefined,
      p_priority: f.priority,
      p_assigned_to: f.assigned_to || undefined,
      p_visit_date: f.assigned_to ? f.visit_date : undefined,
      p_materials: lines.map((l) => ({ product_id: l.product_id, description: l.description, unit: l.unit, qty: l.qty })),
      p_estimated_hours: f.estimated_hours ? Number(f.estimated_hours.replace(',', '.')) : undefined,
      p_lat: coords?.lat,
      p_lng: coords?.lng,
    })
    setSaving(false)
    if (error) {
      setError(errorMessage(error))
      return
    }
    // Valittu kellonaika käynnille (ilman sitä käynti saa seuraavan vapaan ajan).
    if (f.assigned_to && f.start_time) {
      const { data: v } = await supabase.from('job_visits').select('id').eq('job_id', data).limit(1).maybeSingle()
      if (v) await supabase.rpc('set_visit_time', { p_visit_id: v.id, p_start_time: f.start_time, p_duration_minutes: null as unknown as number })
    }
    if (prefill) await supabase.from('quote_requests').update({ status: 'accepted' }).eq('id', prefill.id)
    navigate(`/hallinta/tyot/${data}`, { replace: true })
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Uusi työ" subtitle="Suora työ ilman tarjousta, esim. vikakeikka." />
      <Card className="space-y-3">
        <Field label="Otsikko *">
          <Input required value={f.title} onChange={set('title')} placeholder="Esim. Vikavirtasuojan laukeaminen" />
        </Field>
        <Field label="Kuvaus">
          <VoiceInput value={f.description} onChange={(v) => setF({ ...f, description: v })} rows={3} big={false} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {(['normal', 'urgent'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setF({ ...f, priority: p })}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${f.priority === p ? (p === 'urgent' ? 'bg-rose-600 text-white' : 'bg-ink text-white') : 'border border-slate-300 bg-white'}`}
            >
              {p === 'urgent' ? 'Kiireellinen' : 'Normaali'}
            </button>
          ))}
        </div>
      </Card>

      <Card className="grid gap-3 sm:grid-cols-2">
        <Field label="Asiakas / yhteyshenkilö">
          <Input value={f.customer_name} onChange={set('customer_name')} />
        </Field>
        <Field label="Puhelin">
          <Input type="tel" value={f.contact_phone} onChange={set('contact_phone')} />
        </Field>
        <Field label="Osoite">
          <Input value={f.address} onChange={set('address')} />
        </Field>
        <Field label="Kaupunki">
          <Input value={f.city} onChange={set('city')} />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">Tarvikkeet</h2>
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-1 text-sm">
              {l.description} <span className="text-slate-500">({l.unit})</span>
            </span>
            <Stepper value={l.qty} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: v } : x)))} />
            <Button type="button" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
              ✕
            </Button>
          </div>
        ))}
        <ProductSearch products={products} onPick={(p) => setLines([...lines, { product_id: p.id, description: p.name, unit: p.unit, qty: 1 }])} />
      </Card>

      <Card className="grid gap-3 sm:grid-cols-4">
        <Field label="Asentaja">
          <Select value={f.assigned_to} onChange={set('assigned_to')}>
            <option value="">Delegoi myöhemmin</option>
            {installers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Päivä">
          <Input type="date" value={f.visit_date} onChange={set('visit_date')} disabled={!f.assigned_to} />
        </Field>
        <Field label="Klo" hint="Tyhjä = seuraava vapaa">
          <Input type="time" step={900} value={f.start_time} onChange={set('start_time')} disabled={!f.assigned_to} />
        </Field>
        <Field label="Arvioitu kesto (h)">
          <Input inputMode="decimal" value={f.estimated_hours} onChange={set('estimated_hours')} />
        </Field>
      </Card>

      <ErrorBox error={error} />
      <Button type="submit" big disabled={saving || !f.title.trim()}>
        {saving ? 'Tallennetaan…' : 'Luo työ'}
      </Button>
    </form>
  )
}
