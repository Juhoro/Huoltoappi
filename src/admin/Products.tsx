import { useCallback, useEffect, useState } from 'react'
import { useOrg } from '../auth/AuthProvider'
import { Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner } from '../components/ui'
import { normalizeBarcode } from '../lib/barcode'
import { errorMessage, fmtEur } from '../lib/format'
import { supabase, type Tables } from '../lib/supabase'

type Product = Tables<'products'> & { product_barcodes: Pick<Tables<'product_barcodes'>, 'id' | 'code' | 'multiplier'>[] }

export function Products() {
  const { orgId } = useOrg()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<Product> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('products').select('*, product_barcodes(id, code, multiplier)').eq('organization_id', orgId).order('name')
    setProducts((data ?? []) as Product[])
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  if (!products) return <Spinner />
  const s = q.trim().toLowerCase()
  const shown = products.filter((p) => !s || p.name.toLowerCase().includes(s) || (p.sku ?? '').includes(s) || p.product_barcodes.some((b) => b.code.includes(s)))

  async function addBarcode(p: Product) {
    const code = prompt(`Viivakoodi tuotteelle ${p.name}`)
    if (!code) return
    const mult = Number((prompt('Montako yksikköä yhdessä skannauksessa?', '1') ?? '1').replace(',', '.')) || 1
    const { error } = await supabase.from('product_barcodes').insert({ organization_id: orgId, product_id: p.id, code, normalized_code: normalizeBarcode(code), multiplier: mult })
    if (error) setError(errorMessage(error))
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Tuotteet"
        subtitle={`${products.length} tuotetta`}
        actions={<Button onClick={() => setEdit({ sku_type: 'sahkonumero', unit: 'kpl', pack_size: 1, price: 0, category: 'sähkö', active: true })}>+ Uusi tuote</Button>}
      />
      <Input className="mb-3 max-w-sm" placeholder="Hae nimellä, numerolla tai viivakoodilla" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorBox error={error} />
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Tuote</th>
              <th className="px-3 py-2">Numero</th>
              <th className="px-3 py-2 text-right">Hinta alv 0</th>
              <th className="px-3 py-2">Viivakoodit</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className={`border-t border-slate-100 ${p.active ? '' : 'opacity-50'}`}>
                <td className="px-3 py-2 font-semibold">{p.name}</td>
                <td className="px-3 py-2 text-slate-600">
                  {p.sku_type === 'sahkonumero' ? 'Sähkönro' : p.sku_type === 'lvinumero' ? 'LVI-nro' : ''} {p.sku}
                </td>
                <td className="px-3 py-2 text-right">
                  {fmtEur(Number(p.price))}/{p.unit}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {p.product_barcodes.map((b) => (
                    <div key={b.id}>
                      {b.code}
                      {Number(b.multiplier) !== 1 && ` (×${b.multiplier})`}
                    </div>
                  ))}
                  <button className="text-brand-700 underline" onClick={() => void addBarcode(p)}>
                    + lisää
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" onClick={() => setEdit(p)}>
                    Muokkaa
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ProductModal
        product={edit}
        onClose={() => setEdit(null)}
        onSave={async (p) => {
          const row = {
            organization_id: orgId,
            name: p.name!,
            sku_type: p.sku_type!,
            sku: p.sku || null,
            unit: p.unit!,
            pack_size: Number(p.pack_size) || 1,
            price: Number(p.price) || 0,
            category: p.category!,
            active: p.active ?? true,
          }
          const { error } = p.id ? await supabase.from('products').update(row).eq('id', p.id) : await supabase.from('products').insert(row)
          if (error) setError(errorMessage(error))
          else setEdit(null)
          await load()
        }}
      />
    </div>
  )
}

function ProductModal({ product, onClose, onSave }: { product: Partial<Product> | null; onClose: () => void; onSave: (p: Partial<Product>) => void }) {
  const [p, setP] = useState<Partial<Product>>({})
  useEffect(() => setP(product ?? {}), [product])
  const set = (k: keyof Product) => (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value })
  return (
    <Modal open={!!product} onClose={onClose} title={p.id ? 'Muokkaa tuotetta' : 'Uusi tuote'}>
      <Card className="space-y-3 border-0 p-0 shadow-none">
        <Field label="Nimi">
          <Input value={p.name ?? ''} onChange={set('name')} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Numerotyyppi">
            <Select value={p.sku_type ?? 'other'} onChange={set('sku_type')}>
              <option value="sahkonumero">Sähkönumero</option>
              <option value="lvinumero">LVI-numero</option>
              <option value="other">Muu</option>
            </Select>
          </Field>
          <Field label="Numero">
            <Input value={p.sku ?? ''} onChange={set('sku')} />
          </Field>
          <Field label="Yksikkö">
            <Select value={p.unit ?? 'kpl'} onChange={set('unit')}>
              {['kpl', 'm', 'pkt', 'rll', 'l', 'kg'].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </Field>
          <Field label="Hinta alv 0 (€)">
            <Input inputMode="decimal" value={String(p.price ?? '')} onChange={set('price')} />
          </Field>
          <Field label="Pakkauskoko">
            <Input inputMode="decimal" value={String(p.pack_size ?? 1)} onChange={set('pack_size')} />
          </Field>
          <Field label="Ala">
            <Select value={p.category ?? 'sähkö'} onChange={set('category')}>
              <option value="sähkö">Sähkö</option>
              <option value="lvi">LVI</option>
              <option value="muu">Muu</option>
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.active ?? true} onChange={(e) => setP({ ...p, active: e.target.checked })} /> Käytössä
        </label>
        <Button big className="w-full" disabled={!p.name?.trim()} onClick={() => onSave(p)}>
          Tallenna
        </Button>
      </Card>
    </Modal>
  )
}
