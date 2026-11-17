import { useEffect, useState } from 'react'
import { discardOutboxItem, flushOutbox, onOutboxChange, outboxItems, retryOutboxItem, type OutboxItem } from '../lib/offline'
import { Button } from './ui'

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function useOutbox() {
  const [items, setItems] = useState<OutboxItem[]>([])
  useEffect(() => {
    const load = () => void outboxItems().then(setItems)
    load()
    return onOutboxChange(load)
  }, [])
  return items
}

/** Näyttää verkkotilan ja lähettämättömät kirjaukset. */
export function OfflineStatus() {
  const online = useOnline()
  const items = useOutbox()
  const failed = items.filter((i) => i.failed)
  const pending = items.length - failed.length
  if (online && items.length === 0) return null

  return (
    <div className="space-y-2">
      {(!online || pending > 0) && (
        <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${online ? 'bg-sky-50 text-sky-900' : 'bg-amber-100 text-amber-900'}`}>
          <span>
            {online ? 'Lähetetään tallennettuja kirjauksia…' : 'Ei verkkoyhteyttä. Kirjaukset tallentuvat puhelimeen ja lähtevät, kun yhteys palaa.'}
            {pending > 0 && ` (${pending} odottaa)`}
          </span>
          {online && pending > 0 && (
            <Button variant="secondary" onClick={() => void flushOutbox()}>
              Lähetä
            </Button>
          )}
        </div>
      )}
      {failed.map((i) => (
        <div key={i.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <p>
            <b>{i.label}</b> ei mennyt läpi: {i.failed}
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" onClick={() => void retryOutboxItem(i.id!)}>
              Yritä uudelleen
            </Button>
            <Button variant="ghost" onClick={() => void discardOutboxItem(i.id!)}>
              Hylkää
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
