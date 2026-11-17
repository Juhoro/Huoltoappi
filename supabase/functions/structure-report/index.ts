// Asentajan saneluraportti -> selkeä, jäsennelty työraportti. Asentaja tarkistaa ja vahvistaa.
import { claudeJson } from '../_shared/claude.ts'
import { HttpError, handler, json, requireUser, str } from '../_shared/http.ts'

const list = { type: 'array', items: { type: 'string' } }
const schema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    actions: list,
    materials: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'string' } }, required: ['name', 'qty'], additionalProperties: false },
    },
    issues: list,
    follow_up: list,
    customer_notes: { type: 'string' },
  },
  required: ['summary', 'actions', 'materials', 'issues', 'follow_up', 'customer_notes'],
  additionalProperties: false,
}

const system = `Olet sähkö- ja LVI-huoltoyrityksen työraporttien kirjuri. Saat asentajan puhelimella sanelemaan litteroinnin. Litterointi voi sisältää puheentunnistuksen virheitä, täytesanoja ja puhekieltä.

Kirjoita siitä selkeä, asiallinen työraportti suomeksi:
- summary: yksi lause siitä, mitä kohteessa tehtiin.
- actions: tehdyt toimenpiteet lyhyinä, täsmällisinä kohtina (mitä, missä, montako).
- materials: sanelussa mainitut käytetyt tarvikkeet ja määrät. Jos määrää ei mainittu, qty on tyhjä merkkijono.
- issues: havaitut viat, poikkeamat tai turvallisuushuomiot.
- follow_up: tarvittavat jatkotoimenpiteet tai lisätyöt.
- customer_notes: lyhyt asiakkaalle sopiva yhteenveto (tyhjä, jos ei tarpeen).

Korjaa ilmeiset puheentunnistusvirheet alan termeiksi (esim. "vikavirta suoja" -> vikavirtasuoja, "ryhmä keskus" -> ryhmäkeskus). Älä keksi mitään, mitä sanelussa ei sanota. Jätä tyhjäksi lista, jolle ei ole sisältöä.`

Deno.serve(
  handler(async (req, body) => {
    await requireUser(req)
    const text = str(body.text, 8000)
    if (text.length < 3) throw new HttpError('Raportti on tyhjä', 400)
    const jobTitle = str(body.jobTitle, 200)
    const result = await claudeJson({
      system,
      user: `Työ: ${jobTitle}\n\nAsentajan sanelu:\n<sanelu>\n${text}\n</sanelu>`,
      schema,
    })
    return json(result)
  }),
)
