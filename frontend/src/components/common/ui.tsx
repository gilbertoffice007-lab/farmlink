import { ReactNode } from 'react'
import { PackageSearch, TriangleAlert, Star } from 'lucide-react'

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <PackageSearch className="mx-auto text-muted" size={36} />
      <h3 className="font-bold text-lg mt-3">{title}</h3>
      {hint && <p className="text-muted text-sm mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3" role="alert">
      <TriangleAlert className="text-red-600 mt-0.5" size={18} />
      <div className="text-sm">
        <div className="font-semibold text-red-800">Something needs attention</div>
        <div className="text-red-700">{message}</div>
        {onRetry && <button onClick={onRetry} className="mt-2 underline font-semibold">Try again</button>}
      </div>
    </div>
  )
}

export function Skeletons({ n = 8 }: { n?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="skeleton h-40" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-4 w-1/3" />
        </div>
      ))}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    placed: 'bg-amber-100 text-amber-800', accepted: 'bg-blue-100 text-blue-800',
    preparing: 'bg-violet-100 text-violet-800', ready: 'bg-teal-100 text-teal-800',
    dispatched: 'bg-indigo-100 text-indigo-800', delivered: 'bg-green-100 text-green-800',
    collected: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700', active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-600', suspended: 'bg-red-100 text-red-700',
    approved: 'bg-green-100 text-green-800', pending: 'bg-amber-100 text-amber-800'
  }
  return <span className={`badge ${map[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>
}

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-sm text-red-600 mt-1" role="alert">{msg}</p>
}

export function Stars({ avg, count, size = 13 }: { avg?: number | null; count?: number; size?: number }) {
  if (!avg) return <span className="text-xs text-muted">New listing</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" aria-label={`Rated ${avg} out of 5 from ${count || 0} reviews`}>
      <Star size={size} className="fill-gold text-gold" />
      {avg.toFixed(1)}
      {typeof count === 'number' && count > 0 && <span className="text-muted font-medium">({count})</span>}
    </span>
  )
}

export function VegMark() {
  return (
    <span className="inline-grid place-items-center w-4 h-4 rounded border-2 border-green-700" title="Veg" aria-label="Vegetarian produce">
      <span className="w-1.5 h-1.5 rounded-full bg-green-700" />
    </span>
  )
}
