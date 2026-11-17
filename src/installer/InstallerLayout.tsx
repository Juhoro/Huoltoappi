import { NavLink, Outlet, useOutletContext } from 'react-router-dom'
import { useOrg } from '../auth/AuthProvider'
import { OfflineStatus } from '../components/OfflineStatus'
import { useShift } from './useShift'
import { useActiveTimer } from './useTimer'

type Ctx = { shift: ReturnType<typeof useShift>; timer: ReturnType<typeof useActiveTimer> }
export const useInstaller = () => useOutletContext<Ctx>()

export function InstallerLayout() {
  const { orgId, userId, profile } = useOrg()
  const shift = useShift(orgId, userId)
  const timer = useActiveTimer()

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-ink px-4 py-3 text-white">
        <div>
          <p className="text-xs text-slate-300">Huoltoputki</p>
          <p className="font-semibold">{profile?.full_name}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {timer.active && <span className="rounded-full bg-amber-500 px-2.5 py-1 font-semibold text-ink">⏱ {timer.elapsedLabel}</span>}
          <span className={`rounded-full px-2.5 py-1 font-semibold ${shift.shiftOpen ? 'bg-emerald-500 text-ink' : 'bg-slate-700 text-slate-200'}`}>
            {shift.shiftOpen ? '● Vuorossa' : 'Ei vuorossa'}
          </span>
        </div>
      </header>
      <div className="px-4 pt-3">
        <OfflineStatus />
      </div>
      <main className="flex-1 px-4 pb-28 pt-3">
        <Outlet context={{ shift, timer } satisfies Ctx} />
      </main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-xl grid-cols-3">
          <Tab to="/asentaja" end icon="📋" label="Tänään" />
          <Tab to="/asentaja/tukku" icon="📦" label="Tukku" />
          <Tab to="/asentaja/mina" icon="👤" label="Vuoro" />
        </div>
      </nav>
    </div>
  )
}

function Tab({ to, icon, label, end }: { to: string; icon: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `tap flex flex-col items-center justify-center py-2 text-xs font-semibold ${isActive ? 'text-brand-700' : 'text-slate-500'}`}
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      {label}
    </NavLink>
  )
}
