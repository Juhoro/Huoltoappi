import Anthropic from 'npm:@anthropic-ai/sdk@1.9.0'
import { HttpError } from './http.ts'

const MODEL = Deno.env.get('CLAUDE_MODEL') || 'claude-opus-5-5'

export function aiConfigured() {
  return !!Deno.env.get('ANTHROPIC_API_KEY')
}

let client: Anthropic | null = null

/**
 * Yksi Claude-kutsu, joka palauttaa skeeman mukaisen JSON-olion (structured outputs).
 * Kieltäytymisestä ajetaan palvelinpuolen varamalli (fallbacks: "default").
 * Virhetilanteessa heitetään HttpError: käyttöliittymä jatkaa silloin ilman tekoälyä.
 */
export async function claudeJson<T>(opts: { system: string; user: string; schema: Record<string, unknown>; maxTokens?: number }): Promise<T> {
  if (!aiConfigured()) throw new HttpError('Tekoäly ei ole käytössä (ANTHROPIC_API_KEY puuttuu)', 503)
  client ??= new Anthropic()
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Rutiinijäsennys: matala effort riittää ja pitää vasteajan lyhyenä.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: opts.schema } },
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    } as Parameters<typeof client.beta.messages.create>[0])
    const msg = res as Anthropic.Beta.BetaMessage
    if (msg.stop_reason === 'refusal') throw new HttpError('Tekoäly ei käsitellyt pyyntöä', 422)
    if (msg.stop_reason === 'max_tokens') throw new HttpError('Vastaus jäi kesken', 502)
    const text = msg.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') throw new HttpError('Tyhjä vastaus', 502)
    return JSON.parse(text.text) as T
  } catch (e) {
    if (e instanceof HttpError) throw e
    if (e instanceof Anthropic.RateLimitError) throw new HttpError('Tekoälypalvelu ruuhkautunut, yritä hetken päästä', 429)
    if (e instanceof Anthropic.AuthenticationError) throw new HttpError('Tekoälyn API-avain on virheellinen', 503)
    if (e instanceof Anthropic.APIError) {
      console.error('Claude API', e.status, e.message)
      throw new HttpError('Tekoälypalvelu ei vastannut', 502)
    }
    throw e
  }
}
