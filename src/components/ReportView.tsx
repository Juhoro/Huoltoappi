import type { StructuredReport } from '../lib/ai'

function isStructured(x: unknown): x is StructuredReport {
  return !!x && typeof x === 'object' && 'actions' in x
}

/** Näyttää jäsennellyn raportin; ilman jäsennystä raakatekstin. */
export function ReportView({ structured, raw }: { structured: unknown; raw?: string | null }) {
  if (!isStructured(structured)) {
    return <p className="whitespace-pre-wrap text-slate-800">{raw || '–'}</p>
  }
  const r = structured
  return (
    <div className="space-y-3 text-sm">
      {r.summary && <p className="text-base font-semibold text-slate-900">{r.summary}</p>}
      <List title="Tehdyt toimenpiteet" items={r.actions} />
      {r.materials?.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-700">Käytetyt tarvikkeet (sanelusta)</h4>
          <ul className="ml-5 list-disc">
            {r.materials.map((m, i) => (
              <li key={i}>
                {m.name}
                {m.qty ? ` – ${m.qty}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      <List title="Poikkeamat ja havainnot" items={r.issues} tone="warn" />
      <List title="Jatkotoimenpiteet" items={r.follow_up} />
      {r.customer_notes && (
        <div>
          <h4 className="font-semibold text-slate-700">Asiakkaalle</h4>
          <p>{r.customer_notes}</p>
        </div>
      )}
    </div>
  )
}

function List({ title, items, tone }: { title: string; items: string[] | undefined; tone?: 'warn' }) {
  if (!items?.length) return null
  return (
    <div>
      <h4 className={`font-semibold ${tone === 'warn' ? 'text-amber-800' : 'text-slate-700'}`}>{title}</h4>
      <ul className="ml-5 list-disc">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  )
}
