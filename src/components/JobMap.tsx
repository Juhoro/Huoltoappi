import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { fmtAge, JOB_STATUS, STALE_LOCATION_MIN, type JobStatus } from '../lib/format'

export type MapJob = { id: string; title: string; address: string | null; lat: number; lng: number; status: string; assignee?: string | null }
export type MapPerson = { user_id: string; name: string; color: string; lat: number; lng: number; recorded_at: string; shift_open: boolean; accuracy: number | null }

function personIcon(name: string, color: string, stale: boolean) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return L.divIcon({
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    html: `<div style="width:38px;height:38px;border-radius:50%;background:${stale ? '#94a3b8' : color};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);opacity:${stale ? 0.75 : 1}">${initials}</div>`,
  })
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join(';')
  useEffect(() => {
    if (points.length === 0) return
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

export function JobMap({ jobs, people, height = 480, jobLink }: { jobs: MapJob[]; people: MapPerson[]; height?: number; jobLink: (id: string) => string }) {
  const points = useMemo(() => [...jobs.map((j) => [j.lat, j.lng] as [number, number]), ...people.map((p) => [p.lat, p.lng] as [number, number])], [jobs, people])
  const now = Date.now()

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200" style={{ height }}>
      <MapContainer center={[60.2, 24.94]} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> -tekijät' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={points} />
        {jobs.map((j) => {
          const s = JOB_STATUS[j.status as JobStatus] ?? JOB_STATUS.draft
          return (
            <CircleMarker key={j.id} center={[j.lat, j.lng]} radius={9} pathOptions={{ color: 'white', weight: 2, fillColor: s.color, fillOpacity: 0.95 }}>
              <Popup>
                <b>{j.title}</b>
                <br />
                {j.address}
                <br />
                {s.label}
                {j.assignee ? ` · ${j.assignee}` : ''}
                <br />
                <Link to={jobLink(j.id)}>Avaa työ →</Link>
              </Popup>
            </CircleMarker>
          )
        })}
        {people.map((p) => {
          const stale = !p.shift_open || now - new Date(p.recorded_at).getTime() > STALE_LOCATION_MIN * 60000
          return (
            <Marker key={p.user_id} position={[p.lat, p.lng]} icon={personIcon(p.name, p.color, stale)} zIndexOffset={1000}>
              <Popup>
                <b>{p.name}</b>
                <br />
                Sijainti {fmtAge(p.recorded_at, now)}
                {p.accuracy ? ` (±${Math.round(p.accuracy)} m)` : ''}
                <br />
                {!p.shift_open ? 'Vuoro päättynyt' : stale ? 'Sijainti vanhentunut' : 'Vuorossa'}
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
