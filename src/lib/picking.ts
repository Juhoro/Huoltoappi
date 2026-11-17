// Skannauksen kohdistus (puhdas logiikka, toimii myös offline ladatulla datalla).
// 1) normalisoi koodi  2) hae tuote  3) hae avoimet tarpeet  4) ehdota aikaisinta käyntiä.

import { normalizeBarcode } from './barcode'

export type BarcodeRow = { normalized_code: string; product_id: string; multiplier: number }

export type Need = {
  job_material_id: string
  job_id: string
  job_title: string
  visit_date: string | null
  product_id: string | null
  description: string
  unit: string
  qty_needed: number
  qty_picked: number
  missing: boolean
}

export type ScanMatch =
  | { status: 'unknown'; code: string }
  | { status: 'no_need'; code: string; product_id: string; multiplier: number }
  | { status: 'match'; code: string; product_id: string; multiplier: number; candidates: Need[]; suggestedQty: number }

export function remaining(n: Need): number {
  return Math.max(0, +(n.qty_needed - n.qty_picked).toFixed(3))
}

export function sortNeeds(needs: Need[]): Need[] {
  return [...needs].sort((a, b) => {
    const da = a.visit_date ?? '9999-12-31'
    const db = b.visit_date ?? '9999-12-31'
    if (da !== db) return da < db ? -1 : 1
    return a.job_title.localeCompare(b.job_title, 'fi')
  })
}

export function matchScan(code: string, barcodes: BarcodeRow[], needs: Need[]): ScanMatch {
  const norm = normalizeBarcode(code)
  const bc = barcodes.find((b) => b.normalized_code === norm)
  if (!bc) return { status: 'unknown', code }
  const open = sortNeeds(needs.filter((n) => n.product_id === bc.product_id && remaining(n) > 0))
  if (open.length === 0) return { status: 'no_need', code, product_id: bc.product_id, multiplier: bc.multiplier }
  return {
    status: 'match',
    code,
    product_id: bc.product_id,
    multiplier: bc.multiplier,
    candidates: open,
    // Yksi skannaus = pakkauksen määrä (kerroin). Käyttäjä voi korjata.
    suggestedQty: bc.multiplier,
  }
}

export type PickGroup = {
  key: string
  product_id: string | null
  description: string
  unit: string
  needed: number
  picked: number
  missing: boolean
  needs: Need[]
}

/** Keräilylista tuotteittain: sama tuote useasta työstä yhdelle riville. */
export function groupNeeds(needs: Need[]): PickGroup[] {
  const map = new Map<string, PickGroup>()
  for (const n of sortNeeds(needs)) {
    const key = n.product_id ?? `desc:${n.description.toLowerCase()}`
    const g = map.get(key) ?? {
      key,
      product_id: n.product_id,
      description: n.description,
      unit: n.unit,
      needed: 0,
      picked: 0,
      missing: false,
      needs: [],
    }
    g.needed = +(g.needed + n.qty_needed).toFixed(3)
    g.picked = +(g.picked + Math.min(n.qty_picked, n.qty_needed)).toFixed(3)
    g.missing ||= n.missing
    g.needs.push(n)
    map.set(key, g)
  }
  return [...map.values()].sort((a, b) => {
    const ad = a.picked >= a.needed ? 1 : 0
    const bd = b.picked >= b.needed ? 1 : 0
    if (ad !== bd) return ad - bd
    return a.description.localeCompare(b.description, 'fi')
  })
}
