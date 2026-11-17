// Työn kuvaus + oma tuotekatalogi -> ehdotetut tuoterivit ja työtunnit.
// Malli saa valita vain katalogin tuote-ID:istä; hinnat haetaan selaimessa tietokannasta.
import { claudeJson } from '../_shared/claude.ts'
import { HttpError, handler, json, requireMember, requireUser, str } from '../_shared/http.ts'

type Suggestion = { lines: { product_id: string; qty: number; reason: string }[]; labor_hours: number; notes: string }

Deno.serve(
  handler(async (req, body) => {
    const { client } = await requireUser(req)
    const orgId = str(body.orgId, 64)
    await requireMember(client, orgId, true)
    const description = str(body.description, 4000)
    if (description.length < 5) throw new HttpError('Kuvaus puuttuu', 400)

    const { data: products, error } = await client
      .from('products')
      .select('id, name, sku, unit, category')
      .eq('organization_id', orgId)
      .eq('active', true)
      .limit(1500)
    if (error) throw error
    if (!products?.length) throw new HttpError('Tuotekatalogi on tyhjä', 400)

    const ids = products.map((p) => p.id)
    const catalog = products.map((p) => `${p.id} | ${p.name} | ${p.sku ?? ''} | ${p.unit} | ${p.category}`).join('\n')

    const result = await claudeJson<Suggestion>({
      system: `Olet kokenut sähkö- ja LVI-urakoitsija, joka laatii tarjousta. Valitse työn kuvauksen perusteella tarvittavat tarvikkeet VAIN annetusta tuotekatalogista ja arvioi määrät sekä asennustyön tunnit realistisesti (sisältäen siirtymät kohteessa, testauksen ja siivouksen).
Älä lisää tarvikkeita, joita kuvaus ei edellytä. Jos jotain tarvittavaa ei löydy katalogista, mainitse se notes-kentässä. notes ja reason suomeksi, lyhyesti.`,
      user: `Tuotekatalogi (id | nimi | numero | yksikkö | ala):\n${catalog}\n\nTyön kuvaus:\n<kuvaus>\n${description}\n</kuvaus>`,
      schema: {
        type: 'object',
        properties: {
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: { product_id: { type: 'string', enum: ids }, qty: { type: 'number' }, reason: { type: 'string' } },
              required: ['product_id', 'qty', 'reason'],
              additionalProperties: false,
            },
          },
          labor_hours: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['lines', 'labor_hours', 'notes'],
        additionalProperties: false,
      },
    })

    // Varmistus: vain katalogin tuotteet ja järkevät määrät.
    const valid = new Set(ids)
    result.lines = result.lines.filter((l) => valid.has(l.product_id) && l.qty > 0 && l.qty < 10000)
    result.labor_hours = Math.min(Math.max(0, Math.round(result.labor_hours * 4) / 4), 500)
    return json(result)
  }),
)
