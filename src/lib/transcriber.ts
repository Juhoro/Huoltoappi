// Puhe -> teksti -adapteri. Nyt: selaimen Web Speech API (fi-FI).
// Vaihdettavissa myöhemmin esim. Whisperiin toteuttamalla saman rajapinnan.

export type TranscriberEvents = {
  /** Lopullinen tekstipätkä, joka lisätään tekstiin. */
  onFinal: (text: string) => void
  /** Keskeneräinen arvaus, näytetään harmaana. */
  onInterim: (text: string) => void
  onError: (message: string) => void
  onEnd: () => void
}

export interface Transcriber {
  readonly supported: boolean
  start(events: TranscriberEvents): void
  stop(): void
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function getCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Mikrofonin käyttö estetty. Salli mikrofoni selaimen asetuksista.',
  'service-not-allowed': 'Puheentunnistus ei ole käytettävissä tässä selaimessa.',
  'audio-capture': 'Mikrofonia ei löytynyt.',
  network: 'Puheentunnistus vaatii verkkoyhteyden.',
}

class WebSpeechTranscriber implements Transcriber {
  private rec: SpeechRecognitionLike | null = null
  private active = false
  get supported() {
    return getCtor() !== null
  }

  start(events: TranscriberEvents) {
    const Ctor = getCtor()
    if (!Ctor) {
      events.onError('Puheentunnistus ei ole tuettu tässä selaimessa. Kirjoita teksti kenttään.')
      events.onEnd()
      return
    }
    this.active = true
    const rec = new Ctor()
    rec.lang = 'fi-FI'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) events.onFinal(r[0].transcript.trim())
        else interim += r[0].transcript
      }
      events.onInterim(interim)
    }
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      this.active = false
      events.onError(ERRORS[e.error] ?? `Puheentunnistuksen virhe: ${e.error}`)
    }
    rec.onend = () => {
      // Chrome lopettaa hiljaisuuden jälkeen; jatketaan kunnes käyttäjä pysäyttää.
      if (this.active) {
        try {
          rec.start()
          return
        } catch {
          this.active = false
        }
      }
      events.onInterim('')
      events.onEnd()
    }
    this.rec = rec
    try {
      rec.start()
    } catch (err) {
      this.active = false
      events.onError(String(err))
      events.onEnd()
    }
  }

  stop() {
    this.active = false
    this.rec?.stop()
  }
}

export function createTranscriber(): Transcriber {
  return new WebSpeechTranscriber()
}
