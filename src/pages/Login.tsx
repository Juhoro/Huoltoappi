import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Button, ErrorBox, Field, Input } from '../components/ui'
import { supabase, supabaseConfigured } from '../lib/supabase'

const DEMO = import.meta.env.DEV
  ? [
      { label: 'Johtaja', email: 'johtaja@demo.fi' },
      { label: 'Mikko (sähkö)', email: 'mikko@demo.fi' },
      { label: 'Sanna (LVI)', email: 'sanna@demo.fi' },
    ]
  : []

export function Login() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session && !loading) return <Navigate to="/" replace />

  async function login(e: string, p: string) {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: e, password: p })
    setBusy(false)
    if (error) setError(error.message === 'Invalid login credentials' ? 'Väärä sähköposti tai salasana' : error.message)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <p className="text-3xl">⚡</p>
        <h1 className="text-2xl font-bold">Huoltoputki</h1>
        <p className="mb-5 text-sm text-slate-500">Sähkö- ja LVI-huollon työnohjaus</p>
        {!supabaseConfigured && <ErrorBox error="Supabase-yhteyttä ei ole määritetty (.env.local: VITE_SUPABASE_URL ja VITE_SUPABASE_ANON_KEY)." />}
        <form
          className="space-y-3"
          onSubmit={(ev) => {
            ev.preventDefault()
            void login(email, password)
          }}
        >
          <Field label="Sähköposti">
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Salasana">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <ErrorBox error={error} />
          <Button big type="submit" className="w-full" disabled={busy}>
            {busy ? 'Kirjaudutaan…' : 'Kirjaudu'}
          </Button>
        </form>
        {DEMO.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Demo (kehitysympäristö)</p>
            <div className="grid gap-2">
              {DEMO.map((d) => (
                <Button key={d.email} variant="secondary" disabled={busy} onClick={() => void login(d.email, 'huolto123')}>
                  {d.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
