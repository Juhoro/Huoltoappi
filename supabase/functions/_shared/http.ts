import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

export function fail(message: string, status = 400) {
  return json({ error: message }, status)
}

const URL_ = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? ''

/** Palvelinavain: vain Edge Functionissa, ei koskaan selaimeen. */
export function adminClient(): SupabaseClient {
  return createClient(URL_, SERVICE, { auth: { persistSession: false } })
}

/**
 * Kutsujan tunnistus. Palauttaa käyttäjän oikeuksilla toimivan clientin (RLS pätee) ja
 * käyttäjän id:n. Organisaatio tarkistetaan aina tietokannasta, ei luoteta pyynnön arvoon.
 */
export async function requireUser(req: Request) {
  const auth = req.headers.get('Authorization') ?? ''
  const client = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data, error } = await client.auth.getUser(auth.replace(/^Bearer\s+/i, ''))
  if (error || !data.user) throw new HttpError('Kirjaudu sisään', 401)
  return { client, userId: data.user.id }
}

export async function requireMember(client: SupabaseClient, orgId: string, admin = false) {
  const { data } = await client.rpc(admin ? 'is_admin' : 'is_member', { p_org: orgId })
  if (data !== true) throw new HttpError('Ei oikeutta', 403)
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

/** Yhteinen käsittelijä: CORS, POST-tarkistus ja virheiden muotoilu. */
export function handler(fn: (req: Request, body: Record<string, unknown>) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return fail('Vain POST', 405)
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      return await fn(req, body)
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status)
      console.error(e)
      return fail('Palvelinvirhe', 500)
    }
  }
}

export function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
