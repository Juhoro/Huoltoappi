import { useMemo, useState } from 'react'
import { Input } from '../components/ui'
import { fmtEur } from '../lib/format'
import type { ProductLite } from './data'

/** Tuotehaku nimellä tai sähkö-/LVI-numerolla. */
export function ProductSearch({ products, onPick, placeholder = 'Lisää tuote: nimi tai sähkö/LVI-numero' }: { products: ProductLite[]; onPick: (p: ProductLite) => void; placeholder?: string }) {
  const [q, setQ] = useState('')
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    return products.filter((p) => p.name.toLowerCase().includes(s) || (p.sku ?? '').includes(s)).slice(0, 10)
  }, [q, products])

  return (
    <div className="relative">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      {hits.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {hits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  onPick(p)
                  setQ('')
                }}
              >
                <span>
                  {p.name} <span className="text-xs text-slate-500">{p.sku}</span>
                </span>
                <span className="whitespace-nowrap text-xs text-slate-500">
                  {fmtEur(Number(p.price))}/{p.unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
