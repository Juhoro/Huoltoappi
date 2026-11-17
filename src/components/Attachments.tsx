import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, uuid } from '../lib/format'
import { supabase } from '../lib/supabase'
import { Button, ErrorBox } from './ui'

/** Työn kuvat yksityisessä Storage-bucketissa (polku <org>/<job>/<tiedosto>). Vaatii verkkoyhteyden. */
export function Attachments({ orgId, jobId, canUpload }: { orgId: string; jobId: string; canUpload: boolean }) {
  const [urls, setUrls] = useState<{ id: string; url: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('job_attachments').select('id, path').eq('job_id', jobId).order('created_at')
    if (!data?.length) {
      setUrls([])
      return
    }
    const { data: signed } = await supabase.storage.from('attachments').createSignedUrls(
      data.map((d) => d.path),
      3600,
    )
    setUrls(data.map((d, i) => ({ id: d.id, url: signed?.[i]?.signedUrl ?? '' })).filter((x) => x.url))
  }, [jobId])

  useEffect(() => {
    void load()
  }, [load])

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${orgId}/${jobId}/${uuid()}.${ext}`
      const { error: e1 } = await supabase.storage.from('attachments').upload(path, file, { contentType: file.type })
      if (e1) throw e1
      const { data: u } = await supabase.auth.getUser()
      const { error: e2 } = await supabase.from('job_attachments').insert({ organization_id: orgId, job_id: jobId, path, created_by: u.user!.id })
      if (e2) throw e2
      await load()
    } catch (e) {
      setError(`Kuvan lähetys epäonnistui: ${errorMessage(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((u) => (
            <a key={u.id} href={u.url} target="_blank" rel="noreferrer">
              <img src={u.url} alt="Työkuva" className="aspect-square w-full rounded-lg object-cover" />
            </a>
          ))}
        </div>
      )}
      {canUpload && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f)
              e.target.value = ''
            }}
          />
          <Button type="button" variant="secondary" className="tap w-full" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Lähetetään…' : '📷 Lisää kuva'}
          </Button>
        </>
      )}
      <ErrorBox error={error} />
    </div>
  )
}
