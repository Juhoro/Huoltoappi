import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth, useOrg } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/hallinta', label: 'Tilannekuva', end: true },
  { to: '/hallinta/suunnittelu', label: 'Suunnittelu' },
  { to: '/hallinta/tyot', label: 'Työt' },
  { to: '/hallinta/pyynnot', label: 'Pyynnöt ja tarjoukset', badge: 'requests' as const },
  { to: '/hallinta/laskutus', label: 'Laskutus', badge: 'billing' as const },
  { to: '/hallinta/tuotteet', label: 'Tuotteet' },
  { to: '/hallinta/tiimi', label: 'Tiimi' },
]

export function AdminLayout() {
  const { orgId, org } = useOrg()
  const { profile, signOut } = useAuth()
  const [counts, setCounts] = useState({ requests: 0, billing: 0 })

  useEffect(() => {
    const load = async () => {
      const [r, b] = await Promise.all([
        supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'new'),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'done'),
      ])
      setCounts({ requests: r.count ?? 0, billing: b.count ?? 0 })
    }
    void load()
    const i = setInterval(load, 60_000)
    return () => clearInterval(i)
  }, [orgId])

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print bg-ink text-white lg:fixed lg:inset-y-0 lg:w-60">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:py-5">
          <div>
            <p className="text-lg font-bold">⚡ Huoltoputki</p>
            <p className="text-xs text-slate-400">{org.name}</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:px-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10'}`
              }
            >
              {n.label}
              {n.badge && counts[n.badge] > 0 && <span className="rounded-full bg-brand-500 px-2 text-xs font-bold text-ink">{counts[n.badge]}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 px-4 py-4 text-sm lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <NavLink to="/asentaja" className="mb-2 block rounded-lg bg-white/10 px-3 py-2 text-center font-semibold hover:bg-white/20">
            🧰 Kenttätila
          </NavLink>
          <p className="text-slate-300">{profile?.full_name}</p>
          <button className="text-slate-400 underline" onClick={() => void signOut()}>
            Kirjaudu ulos
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 lg:ml-60 lg:p-8">
        <div className="mb-3 flex justify-end gap-3 text-sm lg:hidden no-print">
          <NavLink to="/asentaja" className="font-semibold text-brand-700">
            🧰 Kenttätila
          </NavLink>
          <button className="text-slate-500 underline" onClick={() => void signOut()}>
            Kirjaudu ulos
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
