// Työnjohto lisää käyttäjän (asentaja tai työnjohto) omaan yritykseensä.
// Vaatii palvelinavaimen, joten tehdään täällä eikä selaimessa.
import { adminClient, fail, handler, json, requireMember, requireUser, str } from '../_shared/http.ts'

Deno.serve(
  handler(async (req, body) => {
    const { client } = await requireUser(req)
    const orgId = str(body.orgId, 64)
    await requireMember(client, orgId, true)

    const full_name = str(body.full_name, 120)
    const email = str(body.email, 200).toLowerCase()
    const phone = str(body.phone, 40)
    const password = typeof body.password === 'string' ? body.password : ''
    const role = body.role === 'admin' ? 'admin' : 'installer'
    if (!full_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Tarkista nimi ja sähköposti.')
    if (password.length < 8) return fail('Salasanan pitää olla vähintään 8 merkkiä.')

    const db = adminClient()
    const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })
    if (error) return fail(error.message.includes('already') ? 'Sähköpostilla on jo käyttäjä.' : error.message)

    const uid = created.user.id
    await db.from('profiles').upsert({ id: uid, full_name, phone: phone || null })
    const { error: mErr } = await db.from('organization_members').insert({ organization_id: orgId, user_id: uid, role })
    if (mErr) throw mErr
    return json({ ok: true, user_id: uid })
  }),
)
