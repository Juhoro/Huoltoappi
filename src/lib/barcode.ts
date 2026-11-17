// Viivakoodien apufunktiot. normalizeBarcode vastaa tietokannan normalize_barcode()-funktiota.

export function normalizeBarcode(code: string): string {
  const compact = code.replace(/\s/g, '')
  if (/^[0-9]+$/.test(compact)) return compact.replace(/^0+/, '')
  return compact.toUpperCase()
}

/** Laskee EAN-13-tarkistenumeron 12 numerosta. */
export function ean13CheckDigit(base12: string): number {
  if (!/^[0-9]{12}$/.test(base12)) throw new Error('EAN-13 tarvitsee 12 numeroa')
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(base12[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}

export function isValidEan13(code: string): boolean {
  return /^[0-9]{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12])
}

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

/** EAN-13 -> 95 moduulin bittijono (1 = musta palkki). */
export function encodeEan13(code: string): string {
  if (!isValidEan13(code)) throw new Error(`Virheellinen EAN-13: ${code}`)
  const first = Number(code[0])
  const parity = PARITY[first]
  let bits = '101'
  for (let i = 1; i <= 6; i++) {
    const d = Number(code[i])
    bits += parity[i - 1] === 'L' ? L[d] : G[d]
  }
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[Number(code[i])]
  bits += '101'
  return bits
}
