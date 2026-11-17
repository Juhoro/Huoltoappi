// Kameraskanneri: selaimen BarcodeDetector (Android Chrome), muuten ZXing (iPhone Safari).

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }

const FORMATS = ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a']

async function nativeDetector(): Promise<Detector | null> {
  const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector
  if (!BD) return null
  try {
    const supported = await BD.getSupportedFormats()
    const formats = FORMATS.filter((f) => supported.includes(f))
    return formats.length ? new BD({ formats }) : null
  } catch {
    return null
  }
}

/**
 * Käynnistää skannauksen videoelementtiin. onCode kutsutaan kerran per tunnistettu koodi
 * (sama koodi uudelleen vasta 2,5 s jälkeen). Palauttaa pysäytysfunktion.
 */
export async function startScanner(video: HTMLVideoElement, onCode: (code: string) => void): Promise<() => void> {
  let last = ''
  let lastAt = 0
  const emit = (code: string) => {
    const now = Date.now()
    if (code === last && now - lastAt < 2500) return
    last = code
    lastAt = now
    navigator.vibrate?.(60)
    onCode(code)
  }

  const detector = await nativeDetector()
  if (detector) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      audio: false,
    })
    video.srcObject = stream
    video.setAttribute('playsinline', 'true')
    await video.play()
    let running = true
    const loop = async () => {
      if (!running) return
      try {
        if (video.readyState >= 2) {
          const codes = await detector.detect(video)
          if (codes[0]?.rawValue) emit(codes[0].rawValue)
        }
      } catch {
        /* yksittäinen ruutu epäonnistui */
      }
      setTimeout(loop, 200)
    }
    void loop()
    return () => {
      running = false
      stream.getTracks().forEach((t) => t.stop())
      video.srcObject = null
    }
  }

  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const reader = new BrowserMultiFormatReader()
  const controls = await reader.decodeFromConstraints(
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    video,
    (result) => {
      if (result) emit(result.getText())
    },
  )
  return () => controls.stop()
}

export function cameraAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}
