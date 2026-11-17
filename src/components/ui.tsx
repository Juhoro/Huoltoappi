import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-slate-800 disabled:bg-slate-400',
  secondary: 'bg-white text-ink border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  ghost: 'text-slate-700 hover:bg-slate-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
}

export function Button({
  variant = 'primary',
  big = false,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; big?: boolean }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed ${
        big ? 'tap px-5 py-3 text-lg' : 'px-3.5 py-2 text-sm'
      } ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}

export function LinkButton({ to, variant = 'secondary', className = '', children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>{children}</span>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function Spinner({ label = 'Ladataan…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-8 text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      {label}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  )
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null
  return <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{error}</div>
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok' }) {
  const cls = { info: 'border-sky-200 bg-sky-50 text-sky-900', warn: 'border-amber-200 bg-amber-50 text-amber-900', ok: 'border-emerald-200 bg-emerald-50 text-emerald-900' }[tone]
  return <div className={`rounded-xl border px-3 py-2 text-sm ${cls}`}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-3xl safe-bottom"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="tap -mr-2 px-3 text-2xl text-slate-500" aria-label="Sulje">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Stepper({ value, onChange, step = 1, min = 0 }: { value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white">
      <button type="button" className="tap w-12 text-2xl font-bold text-slate-700" onClick={() => onChange(Math.max(min, +(value - step).toFixed(3)))} aria-label="Vähennä">
        −
      </button>
      <input
        inputMode="decimal"
        className="w-16 border-x border-slate-200 py-2 text-center text-lg font-semibold outline-none"
        value={String(value).replace('.', ',')}
        onChange={(e) => {
          const n = Number(e.target.value.replace(',', '.'))
          if (!Number.isNaN(n)) onChange(Math.max(min, n))
        }}
      />
      <button type="button" className="tap w-12 text-2xl font-bold text-slate-700" onClick={() => onChange(+(value + step).toFixed(3))} aria-label="Lisää">
        +
      </button>
    </div>
  )
}
