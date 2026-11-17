// Julkinen tarjouspyyntölomake. Ei kirjautumista: validointi, honeypot, nopeusraja per IP
// ja tiedon minimointi. Kirjoittaa palvelinavaimella vain quote_requests-tauluun.
import { adminClient, fail, handler, json, str } from '../_shared/http.ts'

const MAX_PER_HOUR = 5

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(
  handler(async (req, body) => {
    // Honeypot: botti täyttää piilotetun kentän -> näytetään onnistuminen, ei tallenneta.
    if (str(body.website, 200)) return json({ ok: true })

    const slug = str(body.slug, 40)
    const contact_name = str(body.contact_name, 120)
    const phone = str(body.phone, 40)
    const email = str(body.email, 200)
    const address = str(body.address, 200)
    const city = str(body.city, 80)
    const description = str(body.description, 3000)

    if (!contact_name || !phone || description.length < 10) return fail('Täytä nimi, puhelin ja kuvaus (vähintään 10 merkkiä).')
    if (!/^[+0-9 ()-]{5,40}$/.test(phone)) return fail('Tarkista puhelinnumero.')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Tarkista sähköpostiosoite.')
    if (/<\s*script|https?:\/\/\S+.*https?:\/\//i.test(description)) return fail('Viestissä on kiellettyä sisältöä.')

    const db = adminClient()
    const { data: org } = await db.from('organizations').select('id, public_form_enabled').eq('slug', slug).maybeSingle()
    if (!org || !org.public_form_enabled) return fail('Lomaketta ei löydy', 404)

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const ipHash = await sha256(`${ip}:${slug}`)
    const since = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await db.from('public_request_log').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since)
    if ((count ?? 0) >= MAX_PER_HOUR) return fail('Liian monta pyyntöä. Yritä myöhemmin tai soita meille.', 429)
    await db.from('public_request_log').insert({ ip_hash: ipHash })

    const { error } = await db.from('quote_requests').insert({
      organization_id: org.id,
      contact_name,
      phone,
      email: email || null,
      address: address || null,
      city: city || null,
      description,
      source: 'form',
    })
    if (error) throw error
    return json({ ok: true })
  }),
)
