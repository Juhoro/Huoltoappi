import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrg } from '../auth/AuthProvider'
import { Button, Spinner } from '../components/ui'
import { encodeEan13, isValidEan13 } from '../lib/barcode'
import { supabase } from '../lib/supabase'

type Row = { code: string; multiplier: number; products: { name: string; sku: string | null } | null }

/** Tulostettavat demoviivakoodit skannauksen testaamiseen (näytöltä tai paperilta). */
export function TestCodes() {
  const { orgId, role } = useOrg()
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    void supabase
      .from('product_barcodes')
      .select('code, multiplier, products(name, sku)')
      .eq('organization_id', orgId)
      .order('code')
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]))
  }, [orgId])

  if (!rows) return <Spinner />
  return (
    <div className="mx-auto max-w-5xl bg-white p-4">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <Link to={role === 'admin' ? '/hallinta' : '/asentaja/mina'} className="text-brand-700 underline">
          ← Takaisin
        </Link>
        <Button onClick={() => window.print()}>Tulosta</Button>
        <p className="text-sm text-slate-500">Skannaa koodeja puhelimen Tukku-näkymällä toisen laitteen näytöltä tai tulosteesta.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {rows
          .filter((r) => isValidEan13(r.code))
          .map((r) => (
            <div key={r.code} className="break-inside-avoid rounded-lg border border-slate-200 p-2 text-center">
              <Ean13 code={r.code} />
              <p className="mt-1 text-xs font-semibold leading-tight">{r.products?.name}</p>
              {Number(r.multiplier) !== 1 && <p className="text-xs text-amber-700">Pakkaus ×{r.multiplier}</p>}
            </div>
          ))}
      </div>
    </div>
  )
}

function Ean13({ code }: { code: string }) {
  const bits = encodeEan13(code)
  const w = 2
  const quiet = 11
  return (
    <svg viewBox={`0 0 ${(95 + quiet * 2) * w} 70`} className="mx-auto w-full max-w-[220px]" role="img" aria-label={`EAN ${code}`}>
      <rect width="100%" height="100%" fill="white" />
      {[...bits].map((b, i) => (b === '1' ? <rect key={i} x={(quiet + i) * w} y={4} width={w} height={52} fill="black" /> : null))}
      <text x="50%" y={68} textAnchor="middle" fontSize="12" fontFamily="monospace">
        {code}
      </text>
    </svg>
  )
}
