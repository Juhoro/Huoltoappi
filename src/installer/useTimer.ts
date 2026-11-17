import { useCallback, useEffect, useState } from 'react'
import { fmtMinutes, uuid } from '../lib/format'
import { kvDel, kvGet, kvSet, runOrQueue, TIMER_KEY, type ActiveTimer } from '../lib/offline'

/**
 * Käynnissä oleva ajanotto säilyy laitteella (IndexedDB) sivun päivityksen ja verkkokatkon yli.
 * Palvelimelle aloitus ja lopetus menevät lähetysjonon kautta samalla event_id:llä.
 */
export function useActiveTimer() {
  const [active, setActive] = useState<ActiveTimer | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    void kvGet<ActiveTimer>(TIMER_KEY).then((t) => setActive(t ?? null))
  }, [])

  useEffect(() => {
    if (!active) return
    const i = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(i)
  }, [active])

  const elapsedMin = active ? (now - new Date(active.startedAt).getTime()) / 60000 : 0

  const start = useCallback(async (jobId: string, jobTitle: string) => {
    const t: ActiveTimer = { jobId, jobTitle, eventId: uuid(), startedAt: new Date().toISOString() }
    const prev = await kvGet<ActiveTimer>(TIMER_KEY)
    await kvSet(TIMER_KEY, t)
    setActive(t)
    setNow(Date.now())
    // start_work sulkee palvelimella edellisen avoimen ajanoton; suljetaan se myös jonossa.
    if (prev && prev.jobId !== jobId) {
      await runOrQueue('stop_work', { p_start_event_id: prev.eventId, p_ended_at: t.startedAt }, `Ajanoton lopetus: ${prev.jobTitle}`)
    }
    return runOrQueue('start_work', { p_job_id: jobId, p_event_id: t.eventId, p_started_at: t.startedAt }, `Työn aloitus: ${jobTitle}`)
  }, [])

  /** Lopettaa ajanoton; correctedMinutes tallentuu, jos käyttäjä korjasi keston. */
  const stop = useCallback(
    async (correctedMinutes?: number, reason?: string) => {
      const t = active ?? (await kvGet<ActiveTimer>(TIMER_KEY))
      if (!t) return
      await runOrQueue(
        'stop_work',
        {
          p_start_event_id: t.eventId,
          p_ended_at: new Date().toISOString(),
          p_corrected_minutes: correctedMinutes ?? null,
          p_reason: reason ?? null,
        },
        `Ajanoton lopetus: ${t.jobTitle}`,
      )
      await kvDel(TIMER_KEY)
      setActive(null)
    },
    [active],
  )

  return { active, elapsedMin, elapsedLabel: fmtMinutes(elapsedMin), start, stop }
}
