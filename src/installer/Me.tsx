import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useOutbox } from '../components/OfflineStatus'
import { Button, Card, ErrorBox, Notice } from '../components/ui'
import { errorMessage, fmtTime } from '../lib/format'
import { useInstaller } from './InstallerLayout'

export function Me() {
  const { profile, role, signOut, org } = useAuth()
  const { shift, timer } = useInstaller()
  const outbox = useOutbox()
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setError(null)
    try {
      if (shift.shiftOpen) {
        if (timer.active) await timer.stop()
        await shift.end()
      } else await shift.start()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Vuoro</h1>
      <Card>
        <p className="text-lg font-semibold">{profile?.full_name}</p>
        <p className="text-sm text-slate-500">{org?.name}</p>
      </Card>

      <Card>
        <p className="mb-3 font-semibold">{shift.shiftOpen ? 'Olet vuorossa' : 'Et ole vuorossa'}</p>
        <Button big variant={shift.shiftOpen ? 'danger' : 'success'} className="w-full" onClick={() => void toggle()}>
          {shift.shiftOpen ? 'Lopeta päivä' : 'Aloita päivä'}
        </Button>
        <ErrorBox error={error} />
        <div className="mt-3 text-sm text-slate-600">
          {shift.shiftOpen ? (
            <>
              <p>📍 Sijaintisi näkyy työnjohdolle vuoron aikana, kun sovellus on auki.</p>
              {shift.lastSent && <p>Viimeksi lähetetty {fmtTime(new Date(shift.lastSent))}.</p>}
              {shift.geoError && <p className="mt-1 text-rose-700">{shift.geoError}</p>}
            </>
          ) : (
            <p>Sijaintia ei jaeta, kun et ole vuorossa.</p>
          )}
        </div>
      </Card>

      <Notice>
        Sijaintia käytetään vain työkeikkojen koordinointiin. Sijaintihistoria poistetaan automaattisesti 30 päivän jälkeen, ja unohtunut vuoro
        päättyy automaattisesti 12 tunnin jälkeen.
      </Notice>

      {outbox.length > 0 && <Notice tone="warn">Puhelimessa on {outbox.length} lähettämätöntä kirjausta.</Notice>}

      <div className="grid gap-2">
        <Link to="/testikoodit" className="tap flex items-center justify-center rounded-xl border border-slate-300 bg-white font-semibold">
          Testiviivakoodit
        </Link>
        {role === 'admin' && (
          <Link to="/hallinta" className="tap flex items-center justify-center rounded-xl border border-slate-300 bg-white font-semibold">
            ← Työnjohdon näkymään
          </Link>
        )}
        <Button
          variant="ghost"
          className="tap"
          onClick={() => {
            if (outbox.length > 0 && !confirm('Puhelimessa on lähettämättömiä kirjauksia, jotka poistuvat uloskirjautuessa. Kirjaudutaanko silti ulos?')) return
            void signOut()
          }}
        >
          Kirjaudu ulos
        </Button>
      </div>
    </div>
  )
}
