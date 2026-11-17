import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrg } from '../auth/AuthProvider'
import { ScannerView } from '../components/ScannerView'
import { Button, Empty, ErrorBox, Input, Modal, Notice, Spinner, Stepper } from '../components/ui'
import { errorMessage, fmtQty, fmtWeekday, uuid } from '../lib/format'
import { kvGet, kvSet, runOrQueue } from '../lib/offline'
import { groupNeeds, matchScan, remaining, type BarcodeRow, type Need, type PickGroup, type ScanMatch } from '../lib/picking'
import { supabase, type Tables } from '../lib/supabase'
import { loadNeeds, useMyVisits } from './data'

type Product = Pick<Tables<'products'>, 'id' | 'name' | 'sku' | 'sku_type' | 'unit'>

const SKU_LABEL: Record<string, string> = { sahkonumero: 'Sähkönro', lvinumero: 'LVI-nro', other: 'Tuotenro' }

/**
 * Tukkukeräily: kaikkien avointen töiden tarvikkeet tuotteittain. Skannaus tunnistaa tuotteen
 * ja ehdottaa työtä, jolle tuote kohdistetaan. Viivakoodit ja tarpeet ladataan laitteelle,
 * joten tunnistus toimii myös katveessa; kirjaukset lähtevät jonon kautta.
 */
export function Wholesale() {
  const { orgId, userId } = useOrg()
  const { visits } = useMyVisits(userId)
  const [needs, setNeeds] = useState<Need[] | null>(null)
  const [products, setProducts] = useState<Map<string, Product>>(new Map())
  const [barcodes, setBarcodes] = useState<BarcodeRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [match, setMatch] = useState<ScanMatch | null>(null)
  const [pickGroup, setPickGroup] = useState<PickGroup | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const cacheKey = `wholesale:${userId}`

  const loadAll = useCallback(async () => {
    if (!visits) return
    try {
      const [n, p, b] = await Promise.all([
        loadNeeds(visits),
        supabase.from('products').select('id, name, sku, sku_type, unit').eq('organization_id', orgId).eq('active', true),
        supabase.from('product_barcodes').select('normalized_code, product_id, multiplier').eq('organization_id', orgId),
      ])
      if (p.error) throw p.error
      if (b.error) throw b.error
      setNeeds(n)
      setProducts(new Map((p.data ?? []).map((x) => [x.id, x])))
      setBarcodes((b.data ?? []).map((x) => ({ ...x, multiplier: Number(x.multiplier) })))
      await kvSet(cacheKey, { needs: n, products: p.data, barcodes: b.data })
    } catch (e) {
      const cached = await kvGet<{ needs: Need[]; products: Product[]; barcodes: BarcodeRow[] }>(cacheKey)
      if (cached) {
        setNeeds(cached.needs)
        setProducts(new Map(cached.products.map((x) => [x.id, x])))
        setBarcodes(cached.barcodes)
        setError('Ei verkkoyhteyttä – käytetään laitteelle tallennettua listaa.')
      } else setError(errorMessage(e))
    }
  }, [visits, orgId, cacheKey])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const groups = useMemo(() => (needs ? groupNeeds(needs) : []), [needs])

  function flash(text: string) {
    setToast(text)
    setTimeout(() => setToast(null), 2500)
  }

  /** Kirjaa haun ja päivittää listan heti (optimistinen). */
  async function pick(need: Need, qty: number, source: 'scan' | 'manual', code?: string) {
    const r = await runOrQueue(
      'record_pick',
      { p_event_id: uuid(), p_job_material_id: need.job_material_id, p_qty: qty, p_source: source, p_code: code ?? null },
      `Haettu: ${need.description}`,
    )
    setNeeds((ns) => ns!.map((n) => (n.job_material_id === need.job_material_id ? { ...n, qty_picked: +(n.qty_picked + qty).toFixed(3), missing: false } : n)))
    flash(`${need.description}: +${fmtQty(qty)} → ${need.job_title}${r.queued ? ' (jonossa)' : ''}`)
  }

  async function markMissing(g: PickGroup) {
    for (const n of g.needs.filter((x) => remaining(x) > 0)) {
      await runOrQueue('set_material_missing', { p_job_material_id: n.job_material_id, p_missing: true }, `Puuttuu: ${n.description}`)
    }
    setNeeds((ns) => ns!.map((n) => (g.needs.some((x) => x.job_material_id === n.job_material_id && remaining(n) > 0) ? { ...n, missing: true } : n)))
    setPickGroup(null)
  }

  function onCode(code: string) {
    const m = matchScan(code, barcodes, needs ?? [])
    setMatch(m)
    if (m.status !== 'match') {
      void runOrQueue('log_scan', { p_org: orgId, p_event_id: uuid(), p_code: code, p_result: m.status }, 'Skannausloki').catch(() => undefined)
    }
  }

  if (!needs) return error ? <ErrorBox error={error} /> : <Spinner />

  const open = groups.filter((g) => g.picked < g.needed)
  const done = groups.filter((g) => g.picked >= g.needed)

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tukku</h1>
          <p className="text-sm text-slate-500">
            {open.length} tuotetta hakematta · {done.length} haettu
          </p>
        </div>
      </div>
      {error && <Notice tone="warn">{error}</Notice>}

      <Button big className="w-full" onClick={() => setScanOpen(true)}>
        📷 Skannaa viivakoodi
      </Button>

      {groups.length === 0 && <Empty title="Ei haettavia tarvikkeita">Avoimiin töihisi ei ole kirjattu tarvikkeita.</Empty>}

      <ul className="space-y-2">
        {open.map((g) => (
          <GroupRow key={g.key} g={g} product={g.product_id ? products.get(g.product_id) : undefined} onOpen={() => setPickGroup(g)} />
        ))}
      </ul>
      {done.length > 0 && (
        <>
          <h2 className="pt-2 text-sm font-bold uppercase tracking-wide text-slate-500">Haettu</h2>
          <ul className="space-y-2 opacity-70">
            {done.map((g) => (
              <GroupRow key={g.key} g={g} product={g.product_id ? products.get(g.product_id) : undefined} onOpen={() => setPickGroup(g)} />
            ))}
          </ul>
        </>
      )}

      {toast && <div className="fixed inset-x-4 bottom-24 z-[1100] mx-auto max-w-md rounded-2xl bg-emerald-700 px-4 py-3 text-center font-semibold text-white shadow-lg">{toast}</div>}

      <Modal
        open={scanOpen}
        onClose={() => {
          setScanOpen(false)
          setMatch(null)
        }}
        title="Skannaa"
      >
        <ScannerView paused={!!match} onCode={onCode} />
        {match && (
          <ScanResult
            match={match}
            products={products}
            orgId={orgId}
            onDone={() => setMatch(null)}
            onPick={async (need, qty) => {
              await pick(need, qty, 'scan', match.code)
              setMatch(null)
            }}
            onLinked={async () => {
              await loadAll()
              setMatch(null)
            }}
          />
        )}
      </Modal>

      <Modal open={!!pickGroup} onClose={() => setPickGroup(null)} title={pickGroup?.description ?? ''}>
        {pickGroup && (
          <ManualPick
            group={pickGroup}
            onPick={async (need, qty) => {
              await pick(need, qty, 'manual')
              setPickGroup(null)
            }}
            onMissing={() => void markMissing(pickGroup)}
          />
        )}
      </Modal>
    </div>
  )
}

function GroupRow({ g, product, onOpen }: { g: PickGroup; product?: Product; onOpen: () => void }) {
  const done = g.picked >= g.needed
  return (
    <li>
      <button onClick={onOpen} className="tap flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${done ? 'bg-emerald-600 text-white' : g.missing ? 'bg-rose-100 text-rose-700' : 'bg-slate-100'}`}>
          {done ? '✓' : g.missing ? '!' : ''}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-tight">{g.description}</span>
          <span className="block text-xs text-slate-500">
            {product?.sku && `${SKU_LABEL[product.sku_type] ?? ''} ${product.sku} · `}
            {g.needs.length} {g.needs.length === 1 ? 'työ' : 'työtä'}
            {g.missing && ' · ei saatavilla'}
          </span>
        </span>
        <span className="whitespace-nowrap text-right">
          <span className="block text-lg font-bold">
            {fmtQty(g.picked)}/{fmtQty(g.needed)}
          </span>
          <span className="block text-xs text-slate-500">{g.unit}</span>
        </span>
      </button>
    </li>
  )
}

function NeedPicker({ needs, selected, onSelect }: { needs: Need[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {needs.map((n) => (
        <button
          key={n.job_material_id}
          type="button"
          onClick={() => onSelect(n.job_material_id)}
          className={`tap w-full rounded-xl border px-3 py-2 text-left ${selected === n.job_material_id ? 'border-ink bg-ink text-white' : 'border-slate-300 bg-white'}`}
        >
          <span className="block font-semibold">{n.job_title}</span>
          <span className="block text-xs opacity-80">
            {n.visit_date ? fmtWeekday(n.visit_date) : ''} · tarvitaan vielä {fmtQty(remaining(n))} {n.unit}
          </span>
        </button>
      ))}
    </div>
  )
}

function ScanResult({
  match,
  products,
  orgId,
  onDone,
  onPick,
  onLinked,
}: {
  match: ScanMatch
  products: Map<string, Product>
  orgId: string
  onDone: () => void
  onPick: (need: Need, qty: number) => Promise<void>
  onLinked: () => Promise<void>
}) {
  const [selected, setSelected] = useState(match.status === 'match' ? match.candidates[0].job_material_id : '')
  const [qty, setQty] = useState(match.status === 'match' ? match.suggestedQty : 1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (match.status === 'unknown') return <LinkUnknown code={match.code} products={products} orgId={orgId} onDone={onDone} onLinked={onLinked} />

  const product = products.get(match.product_id)
  if (match.status === 'no_need') {
    return (
      <div className="mt-3 space-y-3 rounded-2xl bg-amber-50 p-4">
        <p className="font-bold">{product?.name ?? 'Tuote'}</p>
        <p className="text-sm text-amber-900">Tätä tuotetta ei tarvita avoimissa töissäsi (tai se on jo haettu).</p>
        <Button big className="w-full" variant="secondary" onClick={onDone}>
          Skannaa seuraava
        </Button>
      </div>
    )
  }

  const need = match.candidates.find((c) => c.job_material_id === selected) ?? match.candidates[0]
  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-emerald-50 p-4">
      <div>
        <p className="text-lg font-bold">{product?.name}</p>
        {match.multiplier !== 1 && <p className="text-sm text-emerald-900">Pakkauskoodi: 1 skannaus = {fmtQty(match.multiplier)} {need.unit}</p>}
      </div>
      <p className="text-sm font-semibold">Kohdistetaan työlle:</p>
      <NeedPicker needs={match.candidates} selected={need.job_material_id} onSelect={setSelected} />
      <div className="flex items-center justify-between">
        <span className="font-semibold">Määrä ({need.unit})</span>
        <Stepper value={qty} onChange={setQty} />
      </div>
      <ErrorBox error={error} />
      <Button
        big
        variant="success"
        className="w-full"
        disabled={busy || qty <= 0}
        onClick={async () => {
          setBusy(true)
          try {
            await onPick(need, qty)
          } catch (e) {
            setError(errorMessage(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        ✓ Kuittaa haetuksi
      </Button>
      <Button variant="ghost" className="w-full" onClick={onDone}>
        Peruuta
      </Button>
    </div>
  )
}

function LinkUnknown({ code, products, orgId, onDone, onLinked }: { code: string; products: Map<string, Product>; orgId: string; onDone: () => void; onLinked: () => Promise<void> }) {
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<Product | null>(null)
  const [mult, setMult] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    return [...products.values()].filter((p) => p.name.toLowerCase().includes(s) || (p.sku ?? '').includes(s)).slice(0, 8)
  }, [q, products])

  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-sky-50 p-4">
      <p className="font-bold">Tuntematon koodi {code}</p>
      <p className="text-sm text-sky-900">Etsi tuote, niin sovellus muistaa koodin jatkossa.</p>
      {!chosen ? (
        <>
          <Input placeholder="Tuotteen nimi tai sähkö/LVI-numero" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <ul className="space-y-1">
            {hits.map((p) => (
              <li key={p.id}>
                <button className="tap w-full rounded-xl border border-slate-200 bg-white px-3 text-left" onClick={() => setChosen(p)}>
                  {p.name} <span className="text-xs text-slate-500">{p.sku}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="font-semibold">{chosen.name}</p>
          <div className="flex items-center justify-between">
            <span className="text-sm">Montako {chosen.unit} yhdessä skannauksessa?</span>
            <Stepper value={mult} onChange={setMult} min={1} />
          </div>
          <ErrorBox error={error} />
          <Button
            big
            className="w-full"
            onClick={async () => {
              const { error } = await supabase.rpc('link_barcode', { p_org: orgId, p_code: code, p_product_id: chosen.id, p_multiplier: mult })
              if (error) setError(errorMessage(error))
              else await onLinked()
            }}
          >
            Liitä koodi tuotteeseen
          </Button>
        </>
      )}
      <Button variant="ghost" className="w-full" onClick={onDone}>
        Siirrä myöhemmäksi
      </Button>
    </div>
  )
}

function ManualPick({ group, onPick, onMissing }: { group: PickGroup; onPick: (need: Need, qty: number) => Promise<void>; onMissing: () => void }) {
  const open = group.needs.filter((n) => remaining(n) > 0)
  const [selected, setSelected] = useState(open[0]?.job_material_id ?? group.needs[0].job_material_id)
  const need = group.needs.find((n) => n.job_material_id === selected)!
  const [qty, setQty] = useState(remaining(need) || 1)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Haettu {fmtQty(group.picked)} / {fmtQty(group.needed)} {group.unit}
      </p>
      <NeedPicker
        needs={group.needs}
        selected={selected}
        onSelect={(id) => {
          setSelected(id)
          setQty(remaining(group.needs.find((n) => n.job_material_id === id)!) || 1)
        }}
      />
      <div className="flex items-center justify-between">
        <span className="font-semibold">Määrä ({need.unit})</span>
        <Stepper value={qty} onChange={setQty} min={-need.qty_picked} />
      </div>
      {qty < 0 && <p className="text-xs text-slate-500">Negatiivinen määrä kirjataan palautukseksi.</p>}
      <ErrorBox error={error} />
      <Button
        big
        variant="success"
        className="w-full"
        disabled={qty === 0}
        onClick={async () => {
          try {
            await onPick(need, qty)
          } catch (e) {
            setError(errorMessage(e))
          }
        }}
      >
        {qty < 0 ? 'Kirjaa palautus' : '✓ Kuittaa haetuksi'}
      </Button>
      {open.length > 0 && (
        <Button variant="secondary" className="tap w-full" onClick={onMissing}>
          Ei saatavilla tukusta
        </Button>
      )}
    </div>
  )
}
