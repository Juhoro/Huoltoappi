// Sanelu tai sähköposti -> tarjouspyynnön kentät. Epävarmat kentät merkitään tarkistettaviksi.
import { claudeJson } from '../_shared/claude.ts'
import { HttpError, handler, json, requireUser, str } from '../_shared/http.ts'

const FIELDS = ['contact_name', 'phone', 'email', 'address', 'city', 'description']
const schema = {
  type: 'object',
  properties: {
    contact_name: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    description: { type: 'string' },
    urgent: { type: 'boolean' },
    uncertain_fields: { type: 'array', items: { type: 'string', enum: FIELDS } },
  },
  required: [...FIELDS, 'urgent', 'uncertain_fields'],
  additionalProperties: false,
}

const system = `Poimit sähkö- ja LVI-huoltoyrityksen tarjouspyynnöstä (puhelun sanelu tai sähköposti) yhteystiedot ja työn kuvauksen suomeksi.
- description: selkeä kuvaus tarvittavasta työstä, ilman yhteystietoja.
- urgent: true vain jos kyse on akuutista viasta (vesivuoto, sähkötön, vaara) tai kiireestä mainitaan.
- Puhelinnumerot ja osoitteet kirjoitetaan normaalissa suomalaisessa muodossa.
- Jos kenttää ei mainita, jätä se tyhjäksi. Jos tieto on epäselvä tai arvattu (esim. puheentunnistus on voinut kuulla väärin numeron tai kadunnimen), lisää kentän nimi uncertain_fields-listaan.
Älä keksi tietoja.`

Deno.serve(
  handler(async (req, body) => {
    await requireUser(req)
    const text = str(body.text, 6000)
    if (text.length < 5) throw new HttpError('Teksti on liian lyhyt', 400)
    const result = await claudeJson({ system, user: `<pyynto>\n${text}\n</pyynto>`, schema, maxTokens: 2000 })
    return json(result)
  }),
)
