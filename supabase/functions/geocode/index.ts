// Osoite -> koordinaatit (Nominatim). Käyttöehdot: max 1 pyyntö/s, tunnistettava User-Agent,
// tulosten välimuisti. Välimuisti on tietokannassa, joten samaa osoitetta ei haeta kahdesti.
import { adminClient, handler, json, requireUser, str } from '../_shared/http.ts'

const UA = Deno.env.get('NOMINATIM_USER_AGENT') || 'Huoltoputki/0.1'
let lastCall = 0

Deno.serve(
  handler(async (req, body) => {
    await requireUser(req)
    const address = str(body.address, 200)
    const city = str(body.city, 80)
    if (!address) return json(null)
    const query = `${address}, ${city}, Finland`.toLowerCase().replace(/\s+/g, ' ')
    const db = adminClient()

    const { data: cached } = await db.from('geocode_cache').select('lat, lng, display_name').eq('query', query).maybeSingle()
    if (cached) return json(cached.lat === null ? null : cached)

    // Yksinkertainen nopeusraja tälle instanssille.
    const wait = lastCall + 1100 - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastCall = Date.now()

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fi&q=${encodeURIComponent(`${address}, ${city}`)}`
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'fi' } })
    if (!res.ok) return json(null)
    const hits = (await res.json()) as { lat: string; lon: string; display_name: string }[]
    const hit = hits[0] ? { lat: Number(hits[0].lat), lng: Number(hits[0].lon), display_name: hits[0].display_name } : null
    await db.from('geocode_cache').upsert({ query, lat: hit?.lat ?? null, lng: hit?.lng ?? null, display_name: hit?.display_name ?? null })
    return json(hit)
  }),
)
