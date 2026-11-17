import { JOB_STATUS, READINESS, type JobStatus } from '../lib/format'
import { Badge } from './ui'

export function JobStatusBadge({ status }: { status: string }) {
  const s = JOB_STATUS[status as JobStatus] ?? JOB_STATUS.draft
  return <Badge className={s.cls}>{s.label}</Badge>
}

export function ReadinessBadge({ readiness }: { readiness: string | null | undefined }) {
  if (!readiness || readiness === 'no_materials') return null
  const r = READINESS[readiness]
  return <Badge className={r.cls}>{r.label}</Badge>
}

export function UrgentBadge({ priority }: { priority: string | null | undefined }) {
  if (priority !== 'urgent') return null
  return <Badge className="bg-rose-600 text-white">Kiireellinen</Badge>
}
