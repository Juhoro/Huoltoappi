import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOrg } from '../auth/AuthProvider'
import { Badge, Button, Card, ErrorBox, Field, Input, Notice, PageHeader, Spinner, Textarea } from '../components/ui'
import { suggestQuote } from '../lib/ai'
import { errorMessage, fmtDate, fmtEur, QUOTE_STATUS } from '../lib/format'
import { supabase, type Tables } from '../lib/supabase'
import { useProducts } from './data'
import { ProductSearch } from './ProductSearch'

type Line = Tables<'quote_lines'>

export function quoteTotals(lines: Pick<Line, 'qty' | 'unit_price' | 'vat_rate'>[]) {
  const net = lines.reduce((s, l) => s + Number(l.qty) * Number(l.unit_price), 0)
  const vat = lines.reduce((s, l) => s + (Number(l.qty) * Number(l.unit_price) * Number(l.vat_rate)) / 100, 0)
  return { net, vat, gross: net + vat }
}

export function QuoteEditor() {
  const { id } = useParams<{ id: string }>()
  const { orgId, org } = useOrg()
  const navigate = useNavigate()
  const products = useProducts(orgId)
  const [q, setQ] = useState<Tables<'quotes'> | null>(null)
  const [customer, setCustomer] = useState<Tables<'customers'> | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiNote, setAiNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('quotes').select('*').eq('id', id!).maybeSingle()
    setQ(data)
    if (!data) return
    const [c, l, j] = await Promise.all([
      supabase.from('customers').select('*').eq('id', data.customer_id).maybeSingle(),
      supabase.from('quote_lines').select('*').eq('quote_id', id!).order('sort'),
      supabase.from('jobs').select('id').eq('quote_id', id!).maybeSingle(),
    ])
    setCustomer(c.data)
    setLines(l.data ?? [])
    setJobId(j.data?.id ?? null)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!q) return <Spinner />
  const locked = q.status === 'accepted' || q.status === 'rejected'
  const t = quoteTotals(lines)

  async function run(p: PromiseLike<{ error: unknown }>) {
    setError(null)
    const { error } = await p
    if (error) setError(errorMessage(error))
    await load()
  }

  async function addLine(l: Partial<Line> & { description: string }) {
    await run(
      supabase.from('quote_lines').insert({
        organization_id: orgId,
        quote_id: q!.id,
        kind: l.kind ?? 'product',
        product_id: l.product_id ?? null,
        description: l.description,
        qty: l.qty ?? 1,
        unit: l.unit ?? 'kpl',
        unit_price: l.unit_price ?? 0,
        vat_rate: Number(org.default_vat_rate),
        sort: (lines.at(-1)?.sort ?? 0) + 1,
      }),
    )
  }

  async function suggest() {
    setAiBusy(true)
    setAiNote(null)
    const r = await suggestQuote(orgId, `${q!.title}\n${q!.description}`)
    setAiBusy(false)
    if (!r.ok) {
      setAiNote(`Ehdotusta ei saatu (${r.reason}). Lisää rivit käsin.`)
      return
    }
    // Hinnat haetaan aina omasta tuoterekisteristä, ei tekoälyltä.
    const byId = new Map(products.map((p) => [p.id, p]))
    const rows = r.data.lines.filter((l) => byId.has(l.product_id))
    let sort = lines.at(-1)?.sort ?? 0
    const inserts = rows.map((l) => {
      const p = byId.get(l.product_id)!
      return {
        organization_id: orgId,
        quote_id: q!.id,
        kind: 'product',
        product_id: p.id,
        description: p.name,
        qty: l.qty,
        unit: p.unit,
        unit_price: Number(p.price),
        vat_rate: Number(org.default_vat_rate),
        sort: ++sort,
      }
    })
    if (r.data.labor_hours > 0) {
      inserts.push({
        organization_id: orgId,
        quote_id: q!.id,
        kind: 'labor',
        product_id: null as unknown as string,
        description: 'Asennustyö',
        qty: r.data.labor_hours,
        unit: 'h',
        unit_price: Number(org.hourly_rate),
        vat_rate: Number(org.default_vat_rate),
        sort: ++sort,
      })
    }
    if (inserts.length) await run(supabase.from('quote_lines').insert(inserts))
    await supabase.from('quotes').update({ estimated_hours: r.data.labor_hours }).eq('id', q!.id)
    setAiNote(`Ehdotettu ${rows.length} tuoteriviä ja ${r.data.labor_hours} h työtä. Tarkista määrät.${r.data.notes ? ` Huom: ${r.data.notes}` : ''}`)
  }

  async function acceptAndCreateJob() {
    setError(null)
    const a = await supabase.rpc('accept_quote', { p_quote_id: q!.id })
    if (a.error) return setError(errorMessage(a.error))
    const laborHours = lines.filter((l) => l.kind === 'labor').reduce((s, l) => s + Number(l.qty), 0)
    if (laborHours) await supabase.from('quotes').update({ estimated_hours: laborHours }).eq('id', q!.id)
    const { data, error } = await supabase.rpc('create_job_from_quote', { p_quote_id: q!.id })
    if (error) return setError(errorMessage(error))
    navigate(`/hallinta/tyot/${data}`)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link to="/hallinta/pyynnot" className="text-sm font-semibold text-brand-700">
        ← Pyynnöt ja tarjoukset
      </Link>
      <PageHeader
        title={q.title}
        subtitle={`${customer?.name ?? ''} · voimassa ${fmtDate(q.valid_until)}`}
        actions={
          <>
            <Badge className={QUOTE_STATUS[q.status].cls}>{QUOTE_STATUS[q.status].label}</Badge>
            <Link to={`/hallinta/tarjoukset/${q.id}/tulosta`} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold">
              Tulosta / PDF
            </Link>
          </>
        }
      />
      <ErrorBox error={error} />

      {!locked && (
        <Card className="grid gap-3 sm:grid-cols-2">
          <Field label="Otsikko">
            <Input defaultValue={q.title} onBlur={(e) => e.target.value !== q.title && void run(supabase.from('quotes').update({ title: e.target.value }).eq('id', q.id))} />
          </Field>
          <Field label="Voimassa asti">
            <Input type="date" defaultValue={q.valid_until ?? ''} onBlur={(e) => void run(supabase.from('quotes').update({ valid_until: e.target.value || null }).eq('id', q.id))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Työn kuvaus (näkyy tarjouksessa)">
              <Textarea rows={3} defaultValue={q.description} onBlur={(e) => e.target.value !== q.description && void run(supabase.from('quotes').update({ description: e.target.value }).eq('id', q.id))} />
            </Field>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Rivit</h2>
          {!locked && (
            <Button variant="secondary" disabled={aiBusy} onClick={() => void suggest()}>
              {aiBusy ? 'Mietitään…' : '✨ Ehdota tarvikkeet ja tunnit'}
            </Button>
          )}
        </div>
        {aiNote && <Notice>{aiNote}</Notice>}
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1">Kuvaus</th>
                <th className="py-1 text-right">Määrä</th>
                <th className="py-1 text-right">À-hinta (alv 0)</th>
                <th className="py-1 text-right">Yhteensä</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="py-1.5">
                    {locked ? l.description : <input className="w-full rounded border border-transparent px-1 hover:border-slate-200" defaultValue={l.description} onBlur={(e) => e.target.value !== l.description && void run(supabase.from('quote_lines').update({ description: e.target.value }).eq('id', l.id))} />}
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    {locked ? (
                      Number(l.qty).toLocaleString('fi-FI')
                    ) : (
                      <input
                        className="w-16 rounded border border-slate-200 px-1 text-right"
                        defaultValue={String(l.qty).replace('.', ',')}
                        onBlur={(e) => {
                          const n = Number(e.target.value.replace(',', '.'))
                          if (n > 0 && n !== Number(l.qty)) void run(supabase.from('quote_lines').update({ qty: n }).eq('id', l.id))
                        }}
                      />
                    )}{' '}
                    {l.unit}
                  </td>
                  <td className="py-1.5 text-right">
                    {locked ? (
                      fmtEur(Number(l.unit_price))
                    ) : (
                      <input
                        className="w-20 rounded border border-slate-200 px-1 text-right"
                        defaultValue={String(l.unit_price).replace('.', ',')}
                        onBlur={(e) => {
                          const n = Number(e.target.value.replace(',', '.'))
                          if (n >= 0 && n !== Number(l.unit_price)) void run(supabase.from('quote_lines').update({ unit_price: n }).eq('id', l.id))
                        }}
                      />
                    )}
                  </td>
                  <td className="py-1.5 text-right">{fmtEur(Number(l.qty) * Number(l.unit_price))}</td>
                  <td className="py-1.5 text-right">
                    {!locked && (
                      <button className="text-slate-400 hover:text-rose-600" onClick={() => void run(supabase.from('quote_lines').delete().eq('id', l.id))} aria-label="Poista rivi">
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200">
              <tr>
                <td colSpan={3} className="py-1 text-right">Veroton yhteensä</td>
                <td className="py-1 text-right font-semibold">{fmtEur(t.net)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={3} className="py-1 text-right">ALV {Number(org.default_vat_rate).toLocaleString('fi-FI')} %</td>
                <td className="py-1 text-right">{fmtEur(t.vat)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={3} className="py-1 text-right font-bold">Yhteensä</td>
                <td className="py-1 text-right text-lg font-bold">{fmtEur(t.gross)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {!locked && (
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <ProductSearch products={products} onPick={(p) => void addLine({ product_id: p.id, description: p.name, unit: p.unit, unit_price: Number(p.price) })} />
            <Button variant="secondary" onClick={() => void addLine({ kind: 'labor', description: 'Asennustyö', unit: 'h', qty: 1, unit_price: Number(org.hourly_rate) })}>
              + Työtunnit
            </Button>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        {q.status === 'draft' && (
          <Button
            onClick={() =>
              void run(
                Promise.all([
                  supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', q.id),
                  q.quote_request_id ? supabase.from('quote_requests').update({ status: 'quoted' }).eq('id', q.quote_request_id) : Promise.resolve({ error: null }),
                ]).then(([a]) => a),
              )
            }
          >
            Merkitse lähetetyksi
          </Button>
        )}
        {(q.status === 'draft' || q.status === 'sent') && (
          <>
            <Button variant="success" disabled={lines.length === 0} onClick={() => void acceptAndCreateJob()}>
              Asiakas hyväksyi → luo työ
            </Button>
            <Button variant="ghost" onClick={() => void run(supabase.from('quotes').update({ status: 'rejected' }).eq('id', q.id))}>
              Asiakas hylkäsi
            </Button>
          </>
        )}
        {q.status === 'accepted' && !jobId && <Button onClick={() => void acceptAndCreateJob()}>Luo työ</Button>}
        {jobId && (
          <Link to={`/hallinta/tyot/${jobId}`} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white">
            Avaa työ →
          </Link>
        )}
      </div>
    </div>
  )
}

export function QuotePrint() {
  const { id } = useParams<{ id: string }>()
  const { org } = useOrg()
  const [data, setData] = useState<{ q: Tables<'quotes'>; c: Tables<'customers'> | null; lines: Line[] } | null>(null)
  useEffect(() => {
    void (async () => {
      const { data: q } = await supabase.from('quotes').select('*').eq('id', id!).single()
      if (!q) return
      const [c, l] = await Promise.all([
        supabase.from('customers').select('*').eq('id', q.customer_id).maybeSingle(),
        supabase.from('quote_lines').select('*').eq('quote_id', id!).order('sort'),
      ])
      setData({ q, c: c.data, lines: l.data ?? [] })
    })()
  }, [id])
  if (!data) return <Spinner />
  const { q, c, lines } = data
  const t = quoteTotals(lines)
  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-sm print:p-0">
      <div className="no-print mb-4 flex gap-2">
        <Button onClick={() => window.print()}>Tulosta / tallenna PDF</Button>
        <Link to={`/hallinta/tarjoukset/${q.id}`} className="px-3 py-2 text-brand-700 underline">
          Takaisin
        </Link>
      </div>
      <div className="flex justify-between">
        <div>
          <p className="text-xl font-bold">{org.name}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">TARJOUS</p>
          <p>Päivämäärä {fmtDate(q.sent_at ?? q.created_at)}</p>
          <p>Voimassa {fmtDate(q.valid_until)} asti</p>
        </div>
      </div>
      <div className="mt-6">
        <p className="font-semibold">{c?.name}</p>
        <p>
          {q.address ?? c?.address}, {q.city ?? c?.city}
        </p>
      </div>
      <h1 className="mt-6 text-lg font-bold">{q.title}</h1>
      <p className="mt-1 whitespace-pre-wrap">{q.description}</p>
      <table className="mt-6 w-full">
        <thead className="border-b-2 border-slate-800 text-left">
          <tr>
            <th className="py-1">Kuvaus</th>
            <th className="py-1 text-right">Määrä</th>
            <th className="py-1 text-right">À-hinta</th>
            <th className="py-1 text-right">Yhteensä</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-b border-slate-200">
              <td className="py-1">{l.description}</td>
              <td className="py-1 text-right">
                {Number(l.qty).toLocaleString('fi-FI')} {l.unit}
              </td>
              <td className="py-1 text-right">{fmtEur(Number(l.unit_price))}</td>
              <td className="py-1 text-right">{fmtEur(Number(l.qty) * Number(l.unit_price))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-4 w-64 space-y-1">
        <div className="flex justify-between">
          <span>Veroton</span>
          <span>{fmtEur(t.net)}</span>
        </div>
        <div className="flex justify-between">
          <span>ALV</span>
          <span>{fmtEur(t.vat)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-800 pt-1 text-base font-bold">
          <span>Yhteensä</span>
          <span>{fmtEur(t.gross)}</span>
        </div>
      </div>
      <p className="mt-8 text-xs text-slate-500">Kotitalousvähennykseen oikeuttava työn osuus eritellään laskulla. Tarjous on voimassa yllä mainittuun päivään asti.</p>
    </div>
  )
}
