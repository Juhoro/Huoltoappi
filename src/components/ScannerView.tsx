import { useEffect, useRef, useState } from 'react'
import { cameraAvailable, startScanner } from '../lib/scanner'
import { Button, Input } from './ui'

/** Kameranäkymä + käsin syöttö (varapolku, jos kamera ei toimi). */
export function ScannerView({ onCode, paused }: { onCode: (code: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const cb = useRef(onCode)
  cb.current = onCode

  useEffect(() => {
    if (paused || !cameraAvailable()) return
    let stop: (() => void) | null = null
    let cancelled = false
    setError(null)
    startScanner(videoRef.current!, (c) => cb.current(c))
      .then((s) => {
        if (cancelled) s()
        else stop = s
      })
      .catch((e) => {
        const name = (e as { name?: string }).name
        setError(
          name === 'NotAllowedError'
            ? 'Kameran käyttö estetty. Salli kamera selaimen asetuksista tai syötä koodi käsin.'
            : 'Kameraa ei voitu käynnistää. Kamera vaatii HTTPS-yhteyden. Syötä koodi käsin.',
        )
      })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [paused])

  return (
    <div className="space-y-3">
      {cameraAvailable() && !error ? (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-4 border-white/80" />
          {paused && <div className="absolute inset-0 bg-black/60" />}
        </div>
      ) : (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error ?? 'Kamera ei ole käytettävissä. Syötä koodi käsin.'}</p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim()) {
            onCode(manual.trim())
            setManual('')
          }
        }}
      >
        <Input inputMode="numeric" placeholder="Viivakoodi käsin" value={manual} onChange={(e) => setManual(e.target.value)} />
        <Button type="submit" variant="secondary">
          Hae
        </Button>
      </form>
    </div>
  )
}
