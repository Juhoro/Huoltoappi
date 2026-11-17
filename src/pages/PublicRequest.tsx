import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, ErrorBox, Field, Input, Textarea } from '../components/ui'
import { supabase } from '../lib/supabase'

/**
 * Julkinen tarjouspyyntölomake. Lähetys kulkee Edge Functionin kautta (validointi,
 * roskapostisuoja ja nopeusraja); anonyymi käyttäjä ei kirjoita tietokantaan suoraan.
 */
export function PublicRequest() {
  const { slug } = useParams<{ slug: string }>()
  const [f, setF] = useState({ contact_name: '', phone: '', email: '', address: '', city: '', description: '', website: '' })
  const [consent, setConsent] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.functions.invoke('public-request', { body: { ...f, slug } })
    setBusy(false)
    if (error || data?.error) {
      let msg = data?.error ?? 'Lähetys epäonnistui. Yritä hetken päästä uudelleen tai soita meille.'
      try {
        const j = await (error as { context?: Response })?.context?.json()
        if (j?.error) msg = j.error
      } catch {
        /* ohitetaan */
      }
      setError(msg)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow">
          <p className="text-4xl">✓</p>
          <h1 className="mt-2 text-xl font-bold">Kiitos, pyyntö vastaanotettu!</h1>
          <p className="mt-2 text-slate-600">Otamme yhteyttä mahdollisimman pian.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <div className="rounded-3xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Pyydä tarjous</h1>
        <p className="mb-4 text-sm text-slate-600">Sähkö- ja LVI-työt. Kerro lyhyesti mitä tarvitset, niin palaamme asiaan.</p>
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <Field label="Nimi *">
            <Input required maxLength={120} value={f.contact_name} onChange={set('contact_name')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Puhelin *">
              <Input required type="tel" maxLength={40} value={f.phone} onChange={set('phone')} />
            </Field>
            <Field label="Sähköposti">
              <Input type="email" maxLength={200} value={f.email} onChange={set('email')} />
            </Field>
            <Field label="Kohteen osoite">
              <Input maxLength={200} value={f.address} onChange={set('address')} />
            </Field>
            <Field label="Paikkakunta">
              <Input maxLength={80} value={f.city} onChange={set('city')} />
            </Field>
          </div>
          <Field label="Mitä tarvitset? *">
            <Textarea required rows={5} maxLength={3000} value={f.description} onChange={set('description')} />
          </Field>
          {/* Honeypot: ihminen ei näe kenttää, botti täyttää sen */}
          <input tabIndex={-1} autoComplete="off" className="hidden" aria-hidden name="website" value={f.website} onChange={set('website')} />
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            Hyväksyn, että tietojani käytetään tarjouspyyntöni käsittelyyn ja yhteydenottoon.
          </label>
          <ErrorBox error={error} />
          <Button big type="submit" className="w-full" disabled={busy || !consent}>
            {busy ? 'Lähetetään…' : 'Lähetä pyyntö'}
          </Button>
        </form>
      </div>
    </div>
  )
}
