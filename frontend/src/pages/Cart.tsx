import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Trash2, Minus, Plus, Truck, ArrowRight } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { queryClient } from '../lib/query-client'
import { Empty, ErrorBox } from '../components/common/ui'
import { imgFallback } from '../lib/images'

export default function Cart() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['cart'], queryFn: async () => (await api.get('/cart')).data })
  const { data: policy } = useQuery({ queryKey: ['delivery-policy'], queryFn: async () => (await api.get('/orders/delivery/policy')).data })
  const upd = useMutation({
    mutationFn: ({ id, q }: any) => api.patch(`/cart/items/${id}`, { quantity: q }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
    onError: (e: any) => toast.error(apiError(e))
  })
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/cart/items/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cart'] }); toast.success('Removed') },
    onError: (e: any) => toast.error(apiError(e))
  })

  if (isLoading) return <div className="max-w-4xl mx-auto p-4 space-y-3"><div className="shimmer h-16" /><div className="shimmer h-64" /></div>
  if (isError) return <div className="max-w-4xl mx-auto p-4"><ErrorBox message={apiError(isError)} onRetry={() => refetch()} /></div>
  if (!data?.items?.length) return <div className="max-w-2xl mx-auto p-4 py-10"><Empty title="Your cart is empty" hint="Browse fresh produce and add items." action={<Link to="/market" className="btn-primary">Explore Produce</Link>} /></div>

  const sellers = new Set(data.items.map((i: any) => i.seller_id)).size
  const sub = Number(data.subtotal)
  const FREE_MIN = policy?.free_delivery_min_subtotal ?? 499
  const progress = Math.min(100, (sub / FREE_MIN) * 100)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display font-black text-3xl text-forest">Your cart</h1>

      <div className="card p-4 mt-4 bg-gradient-to-r from-farm-light/60 to-white border-farm/25">
        {sub >= FREE_MIN
          ? <div className="text-sm font-bold text-farm">🎉 FREE delivery unlocked!</div>
          : <div className="text-sm"><b>₹{(FREE_MIN - sub).toFixed(0)}</b> away from <b className="text-farm">FREE delivery</b></div>}
        <div className="h-2.5 rounded-full bg-line/70 mt-2 overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to free delivery">
          <div className="h-full rounded-full bg-gradient-to-r from-leaf to-farm transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {sellers > 1 && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mt-3">Items from <b>{sellers} sellers</b> will be placed as {sellers} separately tracked orders — each farmer fulfils their own produce.</p>}

      <div className="space-y-3 mt-4">
        {data.items.map((i: any) => (
          <div key={i.id} className="card card-hover p-4 flex flex-wrap gap-4 items-center">
            <div className="w-16 h-16 rounded-xl overflow-hidden img-frame shrink-0">
              {i.image_url ? <img src={i.image_url} alt={i.product_name} loading="lazy" onError={imgFallback} /> : null}
            </div>
            <div className="flex-1 min-w-36">
              <div className="font-bold truncate">{i.product_name}</div>
              <div className="text-sm text-muted">₹{Number(i.unit_price).toFixed(2)} /{i.unit} · {i.available_quantity} {i.unit} in stock</div>
              <div className="flex items-center gap-2 mt-2">
                <button aria-label="Decrease quantity" className="btn-secondary !px-2 !py-1.5" onClick={() => upd.mutate({ id: i.id, q: Math.max(0.5, Number(i.quantity) - 1) })}><Minus size={14} /></button>
                <span className="font-bold w-12 text-center">{i.quantity}</span>
                <button aria-label="Increase quantity" className="btn-secondary !px-2 !py-1.5" onClick={() => upd.mutate({ id: i.id, q: Number(i.quantity) + 1 })}><Plus size={14} /></button>
              </div>
            </div>
            <div className="text-right shrink-0 ml-auto">
              <div className="font-extrabold text-lg">₹{Number(i.line_total).toFixed(2)}</div>
              <button aria-label={`Remove ${i.product_name}`} onClick={() => { if (confirm(`Remove ${i.product_name}?`)) del.mutate(i.id) }} className="text-red-500 hover:text-red-700 text-sm mt-1.5 inline-flex items-center gap-1"><Trash2 size={14} /> Remove</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5 mt-4 flex flex-wrap items-center gap-4 justify-between bg-gradient-to-r from-white to-farm-light/40">
        <div>
          <div className="text-sm text-muted flex items-center gap-1.5"><Truck size={14} /> Subtotal · delivery calculated at checkout</div>
          <div className="text-3xl font-display font-black">₹{sub.toFixed(2)}</div>
        </div>
        <Link to="/checkout" className="btn-primary !px-7 !py-3">Checkout <ArrowRight size={17} /></Link>
      </div>
    </div>
  )
}
