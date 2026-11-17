import { describe, expect, it } from 'vitest'
import { encodeEan13, ean13CheckDigit, isValidEan13, normalizeBarcode } from './barcode'
import { toCsv } from './csv'
import { groupNeeds, matchScan, type BarcodeRow, type Need } from './picking'

const need = (o: Partial<Need>): Need => ({
  job_material_id: 'jm',
  job_id: 'j',
  job_title: 'Työ',
  visit_date: '2026-11-17',
  product_id: 'p1',
  description: 'Pistorasia',
  unit: 'kpl',
  qty_needed: 3,
  qty_picked: 0,
  missing: false,
  ...o,
})

const barcodes: BarcodeRow[] = [
  { normalized_code: normalizeBarcode('2000041000226'), product_id: 'p1', multiplier: 1 },
  { normalized_code: normalizeBarcode('2090041000503'), product_id: 'wago', multiplier: 50 },
]

describe('barcode', () => {
  it('normalisoi numerot ja poistaa etunollat (EAN-13 vs UPC/EAN-14)', () => {
    expect(normalizeBarcode(' 0 6414 ')).toBe('6414')
    expect(normalizeBarcode('abc-1')).toBe('ABC-1')
  })
  it('laskee EAN-13-tarkisteen', () => {
    expect(ean13CheckDigit('400638133393')).toBe(1) // tunnettu oikea EAN 4006381333931
    expect(isValidEan13('4006381333931')).toBe(true)
    expect(isValidEan13('4006381333932')).toBe(false)
  })
  it('koodaa EAN-13:n 95 moduuliksi', () => {
    const bits = encodeEan13('4006381333931')
    expect(bits).toHaveLength(95)
    expect(bits.startsWith('101')).toBe(true)
    expect(bits.endsWith('101')).toBe(true)
  })
})

describe('matchScan', () => {
  it('tuntematon koodi', () => {
    expect(matchScan('123', barcodes, []).status).toBe('unknown')
  })

  it('kohdistaa aikaisimpaan käyntiin, jolla tuotetta vielä tarvitaan', () => {
    const needs = [
      need({ job_material_id: 'later', job_title: 'B', visit_date: '2026-11-18' }),
      need({ job_material_id: 'done', job_title: 'A', visit_date: '2026-11-16', qty_picked: 3 }),
      need({ job_material_id: 'first', job_title: 'C', visit_date: '2026-11-17' }),
    ]
    const m = matchScan('2000041000226', barcodes, needs)
    expect(m.status).toBe('match')
    if (m.status !== 'match') return
    expect(m.candidates.map((c) => c.job_material_id)).toEqual(['first', 'later'])
    expect(m.suggestedQty).toBe(1)
  })

  it('pakkauskoodi ehdottaa pakkauksen määrää', () => {
    const m = matchScan('2090041000503', barcodes, [need({ product_id: 'wago', qty_needed: 60 })])
    expect(m.status === 'match' && m.suggestedQty).toBe(50)
  })

  it('ei avointa tarvetta', () => {
    const m = matchScan('2000041000226', barcodes, [need({ qty_picked: 3 })])
    expect(m.status).toBe('no_need')
  })
})

describe('groupNeeds', () => {
  it('yhdistää saman tuotteen eri töistä ja järjestää keräämättömät ensin', () => {
    const groups = groupNeeds([
      need({ job_material_id: 'a', job_id: 'j1', qty_needed: 3, qty_picked: 1 }),
      need({ job_material_id: 'b', job_id: 'j2', qty_needed: 2, qty_picked: 0 }),
      need({ job_material_id: 'c', product_id: 'p2', description: 'Kaapeli', qty_needed: 5, qty_picked: 5 }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ product_id: 'p1', needed: 5, picked: 1 })
    expect(groups[1].product_id).toBe('p2')
  })
})

describe('toCsv', () => {
  it('käyttää puolipistettä, desimaalipilkkua ja lainausmerkkejä', () => {
    const csv = toCsv([{ a: 'x;y', b: 1.5 }], [
      { header: 'A', value: (r) => r.a },
      { header: 'B', value: (r) => r.b },
    ])
    expect(csv).toBe('﻿A;B\r\n"x;y";1,5\r\n')
  })
})

import { minToClock, overlappingIds, timeToMin, visitMinutes, visitRange } from './format'

describe('käyntien ajat', () => {
  it('muuntaa kellonajat', () => {
    expect(timeToMin('08:30:00')).toBe(510)
    expect(minToClock(510)).toBe('8.30')
    expect(visitRange('08:00:00', 150)).toBe('8.00–10.30')
    expect(visitRange(null, 60)).toBeNull()
  })
  it('kesto: oma -> työn arvio -> 60 min', () => {
    expect(visitMinutes(90, 4)).toBe(90)
    expect(visitMinutes(null, 2.5)).toBe(150)
    expect(visitMinutes(null, null)).toBe(60)
  })
  it('tunnistaa päällekkäiset käynnit', () => {
    const ids = overlappingIds([
      { id: 'a', start: 480, minutes: 120 },
      { id: 'b', start: 540, minutes: 60 },
      { id: 'c', start: 600, minutes: 60 },
      { id: 'd', start: null, minutes: 60 },
    ])
    expect([...ids].sort()).toEqual(['a', 'b'])
  })
})
