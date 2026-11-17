import { useState } from 'react'
import { useOrg } from '../auth/AuthProvider'
import { Badge, Button, Card, ErrorBox, Field, Input, Notice, PageHeader, Select } from '../components/ui'
import { errorMessage } from '../lib/format'
import { supabase } from '../lib/supabase'
import { useMembers } from './data'

export function Team() {
  const { orgId, userId } = useOrg()
  const { members, reload } = useMembers(orgId)
  const [f, setF] = useState({ full_name: '', email: '', phone: '', password: '', role: 'installer' })
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    const { data, error } = await supabase.functions.invoke('invite-member', { body: { ...f, orgId } })
    if (error || data?.error) {
      let msg = data?.error ?? errorMessage(error)
      try {
        const j = await (error as { context?: Response })?.context?.json()
        if (j?.error) msg = j.error
      } catch {
        /* ohitetaan */
      }
      setError(msg)
      return
    }
    setOk(`${f.full_name} lisätty. Kirjautuminen: ${f.email} ja antamasi salasana.`)
    setF({ full_name: '', email: '', phone: '', password: '', role: 'installer' })
    await reload()
  }

  async function update(uid: string, patch: { role?: string; active?: boolean }) {
    setError(null)
    const { error } = await supabase.from('organization_members').update(patch).eq('organization_id', orgId).eq('user_id', uid)
    if (error) setError(errorMessage(error))
    await reload()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Tiimi" />
      <ErrorBox error={error} />
      {ok && <Notice tone="ok">{ok}</Notice>}
      <Card>
        <ul className="divide-y divide-slate-100">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: m.color }} />
                <b>{m.full_name}</b> <span className="text-sm text-slate-500">{m.phone}</span>
                {!m.active && <Badge className="bg-slate-200 text-slate-600">Ei käytössä</Badge>}
              </span>
              {m.user_id !== userId ? (
                <span className="flex gap-2">
                  <Select className="w-36 py-1.5 text-sm" value={m.role} onChange={(e) => void update(m.user_id, { role: e.target.value })}>
                    <option value="installer">Asentaja</option>
                    <option value="admin">Työnjohto</option>
                  </Select>
                  <Button variant="ghost" onClick={() => void update(m.user_id, { active: !m.active })}>
                    {m.active ? 'Poista käytöstä' : 'Palauta'}
                  </Button>
                </span>
              ) : (
                <Badge className="bg-ink text-white">Sinä</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Lisää käyttäjä</h2>
        <form onSubmit={(e) => void invite(e)} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nimi">
            <Input required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </Field>
          <Field label="Puhelin">
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Sähköposti">
            <Input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Alkusalasana (väh. 8 merkkiä)">
            <Input required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          </Field>
          <Field label="Rooli">
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="installer">Asentaja</option>
              <option value="admin">Työnjohto</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Lisää
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
