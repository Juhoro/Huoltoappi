import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrg } from '../auth/AuthProvider'
import { Badge, Button, Empty, ErrorBox, PageHeader, Spinner } from '../components/ui'
import { downloadCsv, toCsv } from '../lib/csv'
import { errorMessage, fmtDate, fmtEur, fmtHours, fmtMinutes, isoDate } from '../lib/format'
import { supabase, type Tables } from '../lib/supabase'
import { useRealtime } from './data'

type Summary = {
  job: Tables<'jobs'> & { customers: { name: string } | null }
  minutes: number
  usage: Tables<'material_usage'>[]
  extra: Tables<'job_extra_work'>[]
  reportConfirmed: boolean
  prices: Map<string, number> // product_id -> à-hinta (tarjouksen snapshot tai tuotehinta)
}

export type BillingRow = { job: string; customer: string; address: string; completed: string; type: string; description: string; qty: number; unit: string; unitPrice: number; total: number; report: string }

/** Laskutusaineiston rivit: työtunnit, käytetyt tarvikkeet ja hyväksytyt lisätyöt. */
export function billingRows(s: Summary, hourlyRate: number): BillingRow[] {
  const base = {
    job: s.job.title,
    customer: s.job.customers?.name ?? s.job.contact_name ?? '',
    address: `${s.job.address ?? ''}, ${s.job.city ?? ''}`,
    completed: fmtDate(s.job.completed_at),
    report: s.reportConfirmed ? 'vahvistettu' : 'puuttuu',
  }
  const hours = +(s.minutes / 60).toFixed(2)
  const rows: BillingRow[] = [{ ...base, type: 'Työ', description: 'Asennustyö', qty: hours, unit: 'h', unitPrice: hourlyRate, total: +(hours * hourlyRate).toFixed(2) }]
  for (const u of s.usage) {
    const price = u.product_id ? (s.prices.get(u.product_id) ?? 0) : 0
    rows.push({ ...base, type: 'Tarvike', description: u.description, qty: Number(u.qty), unit: u.unit, unitPrice: price, total: +(Number(u.qty) * price).toFixed(2) })
  }
  for (const x of s.extra.filter((e) => e.status === 'approved')) {
    const h = Number(x.estimated_hours ?? 0)
    rows.push({ ...base, type: 'Lisätyö', description: x.description, qty: h, unit: 'h', unitPrice: hourlyRate, total: +(h * hourlyRate).toFixed(2) })
  }
  return rows
}

export function Billing() {
  const { orgId, org } = useOrg()
  const [done, setDone] = useState<Summary[] | null>(null)
  const [billable, setBillable] = useState<Summary[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: jobs } = await supabase
      .from('jobs')
      .select('*, customers(name)')
      .eq('organization_id', orgId)
      .in('status', ['done', 'billable'])
      .order('completed_at', { ascending: false })
    const list = (jobs ?? []) as Summary['job'][]
    const ids = list.map((j) => j.id)
    if (!ids.length) {
      setDone([])
      setBillable([])
      return
    }
    const quoteIds = list.map((j) => j.quote_id).filter(Boolean) as string[]
    const [t, u, x, r, p, ql] = await Promise.all([
      supabase.from('job_time_totals').select('job_id, minutes').in('job_id', ids),
      supabase.from('material_usage').select('*').in('job_id', ids),
      supabase.from('job_extra_work').select('*').in('job_id', ids),
      supabase.from('job_reports').select('job_id, confirmed_at').in('job_id', ids).not('confirmed_at', 'is', null),
      supabase.from('products').select('id, price').eq('organization_id', orgId),
      quoteIds.length ? supabase.from('quote_lines').select('quote_id, product_id, unit_price').in('quote_id', quoteIds) : Promise.resolve({ data: [] as { quote_id: string; product_id: string | null; unit_price: number }[] }),
    ])
    const productPrice = new Map((p.data ?? []).map((x) => [x.id, Number(x.price)]))
    const summaries = list.map<Summary>((job) => {
      const prices = new Map(productPrice)
      for (const l of ql.data ?? []) if (l.quote_id === job.quote_id && l.product_id) prices.set(l.product_id, Number(l.unit_price))
      return {
        job,
        minutes: Number(t.data?.find((y) => y.job_id === job.id)?.minutes ?? 0),
        usage: (u.data ?? []).filter((y) => y.job_id === job.id),
        extra: (x.data ?? []).filter((y) => y.job_id === job.id),
        reportConfirmed: (r.data ?? []).some((y) => y.job_id === job.id),
        prices,
      }
    })
    setDone(summaries.filter((s) => s.job.status === 'done'))
    setBillable(summaries.filter((s) => s.job.status === 'billable'))
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])
  useRealtime('billing', ['jobs', 'job_reports'], load)

  async function run(p: PromiseLike<{ error: unknown }>) {
    setError(null)
    const { error } = await p
    if (error) setError(errorMessage(error))
    await load()
  }

  function exportCsv() {
    const chosen = billable.filter((s) => selected.size === 0 || selected.has(s.job.id))
    const rows = chosen.flatMap((s) => billingRows(s, Number(org.hourly_rate)))
    const csv = toCsv(rows, [
      { header: 'Työ', value: (r) => r.job },
      { header: 'Asiakas', value: (r) => r.customer },
      { header: 'Osoite', value: (r) => r.address },
      { header: 'Valmistunut', value: (r) => r.completed },
      { header: 'Rivityyppi', value: (r) => r.type },
      { header: 'Kuvaus', value: (r) => r.description },
      { header: 'Määrä', value: (r) => r.qty },
      { header: 'Yksikkö', value: (r) => r.unit },
      { header: 'À-hinta alv 0', value: (r) => r.unitPrice },
      { header: 'Yhteensä alv 0', value: (r) => r.total },
      { header: 'Raportti', value: (r) => r.report },
    ])
    downloadCsv(`laskutus-${isoDate()}.csv`, csv)
  }

  if (!done) return <Spinner />

  return (
    <div className="space-y-6">
      <PageHeader title="Laskutus" subtitle="Valmistunut työ ei mene laskulle ennen kuin hyväksyt sen." />
      <ErrorBox error={error} />

      <section>
        <h2 className="mb-2 font-bold">1. Tarkistettavat valmiit työt ({done.length})</h2>
        {done.length === 0 ? (
          <Empty title="Ei tarkistettavia töitä" />
        ) : (
          <div className="space-y-2">
            {done.map((s) => {
              const pending = s.extra.filter((x) => x.status === 'pending').length
              return (
                <div key={s.job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <div>
                    <Link to={`/hallinta/tyot/${s.job.id}`} className="font-semibold hover:underline">
                      {s.job.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {s.job.customers?.name ?? s.job.contact_name} · valmis {fmtDate(s.job.completed_at)} · {fmtMinutes(s.minutes)} · {s.usage.length} tarviketta
                    </p>
                    <div className="mt-1 flex gap-1">
                      {s.reportConfirmed ? <Badge className="bg-emerald-100 text-emerald-800">Raportti ✓</Badge> : <Badge className="bg-rose-100 text-rose-800">Raportti puuttuu</Badge>}
                      {pending > 0 && <Badge className="bg-amber-100 text-amber-800">{pending} lisätyötä hyväksymättä</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/hallinta/tyot/${s.job.id}`} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold">
                      Tarkista
                    </Link>
                    <Button variant="success" disabled={pending > 0} onClick={() => void run(supabase.rpc('approve_billing', { p_job_id: s.job.id }))}>
                      Hyväksy laskutettavaksi
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">2. Laskutettavissa ({billable.length})</h2>
          {billable.length > 0 && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={exportCsv}>
                ⬇ Vie CSV {selected.size ? `(${selected.size})` : '(kaikki)'}
              </Button>
              <Button
                disabled={selected.size === 0}
                onClick={() => {
                  if (confirm(`Merkitäänkö ${selected.size} työtä laskutetuksi?`)) {
                    void run(supabase.rpc('mark_invoiced', { p_job_ids: [...selected] }))
                    setSelected(new Set())
                  }
                }}
              >
                Merkitse laskutetuksi
              </Button>
            </div>
          )}
        </div>
        {billable.length === 0 ? (
          <Empty title="Ei laskutettavia töitä" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Valitse kaikki"
                      checked={selected.size === billable.length}
                      onChange={(e) => setSelected(e.target.checked ? new Set(billable.map((s) => s.job.id)) : new Set())}
                    />
                  </th>
                  <th className="px-3 py-2">Työ</th>
                  <th className="px-3 py-2 text-right">Tunnit</th>
                  <th className="px-3 py-2 text-right">Yhteensä alv 0</th>
                </tr>
              </thead>
              <tbody>
                {billable.map((s) => {
                  const total = billingRows(s, Number(org.hourly_rate)).reduce((a, r) => a + r.total, 0)
                  return (
                    <tr key={s.job.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(s.job.id)}
                          onChange={(e) => {
                            const n = new Set(selected)
                            if (e.target.checked) n.add(s.job.id)
                            else n.delete(s.job.id)
                            setSelected(n)
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Link to={`/hallinta/tyot/${s.job.id}`} className="font-semibold hover:underline">
                          {s.job.title}
                        </Link>
                        <div className="text-xs text-slate-500">{s.job.customers?.name ?? s.job.contact_name}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{fmtHours(s.minutes)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtEur(total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Tuntihinta {fmtEur(Number(org.hourly_rate))}/h. Tarvikkeiden hinta tarjouksen rivistä, muuten tuoterekisteristä. Tuo CSV laskutusohjelmaan.
        </p>
      </section>
    </div>
  )
}
