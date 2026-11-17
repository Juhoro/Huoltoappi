import { useEffect, useRef, useState } from 'react'
import { createTranscriber } from '../lib/transcriber'
import { Textarea } from './ui'

/**
 * Tekstikenttä + iso mikrofoninappi. Puhe lisätään tekstin perään; tekstiä voi aina
 * muokata ja kirjoittaa käsin (varapolku, jos puhe ei toimi).
 */
export function VoiceInput({
  value,
  onChange,
  placeholder,
  rows = 6,
  big = true,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  big?: boolean
}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const transcriber = useRef(createTranscriber())
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => () => transcriber.current.stop(), [])

  function toggle() {
    if (listening) {
      transcriber.current.stop()
      return
    }
    setError(null)
    setListening(true)
    transcriber.current.start({
      onFinal: (t) => {
        if (!t) return
        const cur = valueRef.current
        const sep = cur && !/\s$/.test(cur) ? ' ' : ''
        onChange(cur + sep + t)
      },
      onInterim: setInterim,
      onError: setError,
      onEnd: () => {
        setListening(false)
        setInterim('')
      },
    })
  }

  const supported = transcriber.current.supported

  return (
    <div className="space-y-3">
      {supported && (
        <button
          type="button"
          onClick={toggle}
          className={`tap flex w-full items-center justify-center gap-3 rounded-2xl px-4 font-bold text-white transition ${
            big ? 'py-5 text-xl' : 'py-3 text-base'
          } ${listening ? 'animate-pulse bg-rose-600' : 'bg-brand-700 hover:bg-brand-600'}`}
          aria-pressed={listening}
        >
          <MicIcon />
          {listening ? 'Kuuntelen… paina lopettaaksesi' : 'Paina ja puhu'}
        </button>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <div className="relative">
        <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        {interim && <p className="mt-1 text-sm italic text-slate-400">{interim}</p>}
      </div>
      {!supported && <p className="text-xs text-slate-500">Puheentunnistus ei ole tuettu tässä selaimessa – kirjoita teksti kenttään.</p>}
    </div>
  )
}

function MicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" strokeLinecap="round" />
    </svg>
  )
}
