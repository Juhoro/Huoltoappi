import { useCallback, useEffect, useRef, useState } from 'react'
import { runOrQueue } from '../lib/offline'
import { supabase } from '../lib/supabase'

const MIN_INTERVAL_MS = 60_000
const MIN_DISTANCE_M = 100

function distanceM(a: GeolocationCoordinates, b: { lat: number; lng: number }) {
  const R = 6371000
  const dLat = ((b.lat - a.latitude) * Math.PI) / 180
  const dLng = ((b.lng - a.longitude) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/**
 * Työvuoro ja sijainnin jakaminen. Sijaintia lähetetään vain vuoron aikana ja vain kun
 * sovellus on auki (PWA-rajoitus): enintään kerran minuutissa, tai jos liikuttu yli 100 m.
 */
export function useShift(orgId: string, userId: string) {
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [lastSent, setLastSent] = useState<number | null>(null)
  const last = useRef<{ at: number; lat: number; lng: number } | null>(null)

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('shifts').select('id').eq('user_id', userId).is('ended_at', null).maybeSingle()
    setShiftId(data?.id ?? null)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!shiftId) return
    if (!('geolocation' in navigator)) {
      setGeoError('Laite ei tue sijaintia')
      return
    }
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null)
        const now = Date.now()
        const prev = last.current
        if (prev && now - prev.at < MIN_INTERVAL_MS && distanceM(pos.coords, prev) < MIN_DISTANCE_M) return
        last.current = { at: now, lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLastSent(now)
        void runOrQueue(
          'insert:location_pings',
          {
            organization_id: orgId,
            user_id: userId,
            shift_id: shiftId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            recorded_at: new Date(pos.timestamp).toISOString(),
          },
          'Sijainti',
        ).catch(() => undefined)
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Sijainnin käyttö estetty. Salli sijainti selaimen asetuksista.'
            : 'Sijaintia ei saatu. Sijainti vaatii HTTPS-yhteyden.',
        )
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 },
    )
    return () => navigator.geolocation.clearWatch(watch)
  }, [shiftId, orgId, userId])

  async function start() {
    const { data, error } = await supabase.rpc('start_shift', { p_org: orgId })
    if (error) throw error
    setShiftId(data)
  }

  async function end() {
    const { error } = await supabase.rpc('end_shift')
    if (error) throw error
    last.current = null
    setShiftId(null)
  }

  return { shiftOpen: !!shiftId, loading, geoError, lastSent, start, end }
}
