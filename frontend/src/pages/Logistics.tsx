import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Truck, Printer, Route } from 'lucide-react'
import { api } from '../lib/api'
import { ErrorBox } from '../components/common/ui'

export default function Logistics() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['logistics'], queryFn: async () => (await api.get('/logistics/suggestions')).data
  })
  const [selected, setSelected] = useState<number[]>([])
  const toggle = (id: number) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])

  const all = useMemo(() => [...(data?.groups || []).flatMap((g: any) => g.orders), ...(data?.ungrouped || [])], [data])
  const runOrders = all.filter((o: any) => selected.includes(o.order_id))

  if (isLoading) return <div className="max-w-5xl mx-auto p-4 space-y-3"><div className="shimmer h-24" /><div className="shimmer h-64" /></div>
  if (isError) return <div className="max-w-4xl mx-auto p-4"><ErrorBox message="Logistics is available to sellers and admins. Please sign in with such an account." onRetry={() => refetch()} /></div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl text-forest flex items-center gap-2.5"><Truck className="text-farm" /> Delivery runs</h1>
          <p className="text-sm text-muted mt-1">{data.method}</p>
        </div>
        {runOrders.length > 0 && (
          <button onClick={() => window.print()} className="btn-primary no-print"><Printer size={16} /> Print run sheet ({runOrders.length})</button>
        )}
      </div>
      <p className="text-sm mt-3">Reviewing <b>{data.count}</b> fulfilment-ready orders. Tick orders to build a run sheet — nothing is auto-merged.</p>

      <h2 className="font-display font-bold text-xl mt-7 flex items-center gap-2"><Route size={18} className="text-farm" /> Suggested combined lanes</h2>
      {(data.groups || []).length === 0 && <p className="text-sm text-muted mt-2">No combinable lanes right now — each order ships on its own.</p>}
      {(data.groups || []).map((g: any, i: number) => (
        <div key={i} className="card card-hover p-5 mt-3">
          <div className="font-bold text-lg">{g.pickup} <span className="text-farm">→</span> {g.delivery} <span className="badge bg-farm-light text-farm ml-1">{g.orders.length} orders</span></div>
          <p className="text-sm text-muted mt-0.5">{g.suggestion}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {g.orders.map((o: any) => (
              <label key={o.order_id} className="badge bg-cream border border-line !py-1.5 !px-3 cursor-pointer has-[:checked]:border-farm has-[:checked]:bg-farm-light transition">
                <input type="checkbox" checked={selected.includes(o.order_id)} onChange={() => toggle(o.order_id)} className="accent-[#28784A]" />
                <Link to={`/orders/${o.order_id}`} className="font-bold hover:text-farm">{o.order_number}</Link>
                {o.distance_km ? <span className="text-muted">· {o.distance_km} km</span> : null}
                <span className="font-bold">· ₹{o.total}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <h2 className="font-display font-bold text-xl mt-7">Single-lane orders</h2>
      <div className="space-y-2 mt-2">
        {(data.ungrouped || []).map((o: any) => (
          <label key={o.order_id} className="card p-3.5 text-sm flex gap-3 items-center cursor-pointer has-[:checked]:border-farm transition">
            <input type="checkbox" checked={selected.includes(o.order_id)} onChange={() => toggle(o.order_id)} className="accent-[#28784A]" />
            <Link to={`/orders/${o.order_id}`} className="font-bold hover:text-farm">{o.order_number}</Link>
            <span className="text-muted">{o.pickup_city} → {o.delivery_city}</span>
            {o.distance_km && <span className="badge bg-farm-light text-farm">{o.distance_km} km (haversine)</span>}
            <span className="ml-auto font-bold">₹{o.total}</span>
          </label>
        ))}
      </div>

      {runOrders.length > 0 && (
        <div className="card print-card p-6 mt-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-display font-black text-2xl">Delivery run sheet</h2>
              <p className="text-sm text-muted">Run DR-{new Date().toISOString().slice(0, 10)} · {runOrders.length} stops · Nearest-neighbour order is a suggestion — plan your own route.</p>
            </div>
            <span className="badge bg-forest text-white !text-sm !px-3 !py-1">DRAFT — review only</span>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm mt-4 min-w-[560px]">
            <thead><tr className="text-left text-muted border-b border-line"><th className="py-2">#</th><th className="py-2">Order</th><th className="py-2">Route</th><th className="py-2">Amount</th><th className="py-2">Delivered ✓</th></tr></thead>
            <tbody>
              {runOrders.map((o: any, i: number) => (
                <tr key={o.order_id} className="border-b border-line/70 last:border-0">
                  <td className="py-2.5 font-bold">{i + 1}</td>
                  <td className="py-2.5 font-semibold">{o.order_number}</td>
                  <td className="py-2.5">{o.pickup_city} → {o.delivery_city}{o.distance_km ? ` (${o.distance_km} km)` : ''}</td>
                  <td className="py-2.5">₹{o.total}</td>
                  <td className="py-2.5"><span className="inline-block w-8 h-8 rounded-lg border border-line" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="text-xs text-muted mt-3">Buyer phone/address details stay inside each order page — only open orders you are authorised to fulfil. Collect COD in cash where applicable.</p>
        </div>
      )}
    </div>
  )
}
