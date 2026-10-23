import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Truck, CalendarClock, MessageSquare, MapPin, CheckCircle2, Circle, PackageCheck } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { queryClient } from '../lib/query-client'
import { ErrorBox, StatusBadge, Stars } from '../components/common/ui'
import { SpeakButton } from '../components/voice/SpeakButton'

const STEPS = [
  { id: 'placed', label: 'Order placed', hint: 'We notified the farmer' },
  { id: 'accepted', label: 'Seller accepted', hint: 'Your slot is confirmed' },
  { id: 'preparing', label: 'Preparing order', hint: 'Harvest & packing' },
  { id: 'ready', label: 'Ready', hint: 'Packed, awaiting dispatch' },
  { id: 'dispatched', label: 'On the way', hint: 'Out for delivery' },
  { id: 'delivered', label: 'Delivered', hint: 'Enjoy your produce' },
]
const NEXT: Record<string, string[]> = {
  placed: ['accepted', 'rejected'], accepted: ['preparing'], preparing: ['ready'],
  ready: ['dispatched', 'delivered', 'collected'], dispatched: ['delivered']
}
const SLOT_LABELS: Record<string, string> = {
  today_evening: 'Today · 4–8 PM', tomorrow_morning: 'Tomorrow · 7–11 AM',
  tomorrow_evening: 'Tomorrow · 4–8 PM', day_after_morning: 'Day after · 7–11 AM',
}

function fmt(dt?: string) {
  if (!dt) return ''
  return new Date(dt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export default function OrderDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const [review, setReview] = useState({ rating: 5, comment: '' })
  const { data: o, isLoading, isError, refetch } = useQuery({
    queryKey: ['order', id], queryFn: async () => (await api.get(`/orders/${id}`)).data
  })
  const act = useMutation({
    mutationFn: async ({ url, body }: any) => (await api.post(url, body || {})).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['order', id] }); queryClient.invalidateQueries({ queryKey: ['orders'] }); toast.success('Updated') },
    onError: (e: any) => toast.error(apiError(e))
  })
  const submitReview = async (productId: number) => {
    try {
      await api.post(`/products/${productId}/reviews`, { rating: review.rating, comment: review.comment, order_id: id })
      toast.success('Thanks for your review!')
    } catch (e: any) { toast.error(apiError(e)) }
  }

  if (isLoading) return <div className="max-w-3xl mx-auto p-4 space-y-3"><div className="shimmer h-24" /><div className="shimmer h-64" /></div>
  if (isError || !o) return <div className="max-w-3xl mx-auto p-4"><ErrorBox message="Order not found." onRetry={() => refetch()} /></div>

  const isSeller = user?.id === o.seller_id
  const idx = STEPS.findIndex((s) => s.id === o.status)
  const terminal = ['cancelled', 'rejected', 'collected'].includes(o.status)
  const histByStatus: Record<string, any> = {}
  ;(o.history || []).forEach((h: any) => { histByStatus[h.new_status] = h })

  const speech = [
    `Order ${o.order_number}. Status ${o.status}.`,
    `${o.fulfillment_type === 'pickup' ? 'Farm pickup' : 'Home delivery'}.`,
    `Estimated ${o.fulfillment_type === 'pickup' ? 'pickup' : 'delivery'} ${fmt(o.estimated_delivery)}.`,
    o.delivery_slot ? `Time slot ${SLOT_LABELS[o.delivery_slot] || o.delivery_slot}.` : '',
    `Total ${Number(o.total_amount).toFixed(2)} rupees.`,
    `Items: ${(o.items || []).map((i: any) => `${i.product_name_snapshot}, ${i.quantity} ${i.unit_snapshot}`).join('; ')}.`,
    o.source === 'harvest_rescue' ? 'This order came from a Harvest Rescue Exchange offer.' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display font-black text-3xl text-forest">{o.order_number}</h1>
        <StatusBadge status={o.status} />
        <SpeakButton text={speech} label="Read order" compact className="ml-auto" />
      </div>
      <p className="text-sm text-muted mt-1">
        Buyer: {o.buyer_name} · Seller: {o.seller_name} · {o.fulfillment_type === 'pickup' ? 'Farm pickup' : 'Home delivery'} · {o.payment_method === 'cod' ? 'Cash on Delivery' : 'Simulated online (demo)'}
      </p>

      {/* Delivery card */}
      <div className="card p-5 mt-4 bg-gradient-to-r from-farm-light/60 to-white border-farm/25">
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div className="flex gap-2.5">
            <Truck size={18} className="text-farm shrink-0 mt-0.5" />
            <div><div className="text-muted text-xs font-semibold">ESTIMATED {o.fulfillment_type === 'pickup' ? 'PICKUP' : 'DELIVERY'}</div>
              <div className="font-extrabold">{fmt(o.estimated_delivery)} <span className="font-medium text-muted text-xs">(estimate)</span></div></div>
          </div>
          {o.delivery_slot && (
            <div className="flex gap-2.5">
              <CalendarClock size={18} className="text-farm shrink-0 mt-0.5" />
              <div><div className="text-muted text-xs font-semibold">SLOT</div><div className="font-extrabold">{SLOT_LABELS[o.delivery_slot] || o.delivery_slot}</div></div>
            </div>
          )}
          <div className="flex gap-2.5">
            <PackageCheck size={18} className="text-farm shrink-0 mt-0.5" />
            <div><div className="text-muted text-xs font-semibold">TOTAL</div><div className="font-extrabold">₹{Number(o.total_amount).toFixed(2)}</div></div>
          </div>
        </div>
        {o.delivery_instructions && (
          <div className="mt-3 text-sm flex gap-2 bg-white/70 rounded-xl px-3 py-2 border border-line">
            <MessageSquare size={15} className="text-farm shrink-0 mt-0.5" /><span><b>Delivery note:</b> {o.delivery_instructions}</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      {!terminal && (
        <ol className="card p-4 sm:p-6 mt-4" aria-label="Delivery tracking timeline">
          {STEPS.map((s, i) => {
            const doneStep = idx >= 0 && i <= idx
            const current = i === idx
            const h = histByStatus[s.id]
            return (
              <li key={s.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  {doneStep
                    ? <CheckCircle2 size={22} className={current ? 'text-farm' : 'text-leaf'} aria-hidden="true" />
                    : <Circle size={22} className="text-line" aria-hidden="true" />}
                  {i < STEPS.length - 1 && <span className={`w-0.5 flex-1 min-h-6 ${i < idx ? 'bg-leaf' : 'bg-line'}`} />}
                </div>
                <div className={`pb-6 ${current ? '' : ''}`}>
                  <div className={`font-bold ${doneStep ? '' : 'text-muted'}`}>{s.label}{current && <span className="badge bg-farm-light text-farm ml-2">current</span>}</div>
                  <div className="text-xs text-muted">{s.hint}{h?.created_at ? ` · ${fmt(h.created_at)}` : ''}</div>
                  {h?.note && <div className="text-xs mt-0.5 italic text-muted">“{h.note}”</div>}
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {terminal && (
        <div className="card p-5 mt-4 text-sm flex gap-2.5 items-start">
          <MapPin size={17} className="text-muted mt-0.5" />
          <span>This order was <b>{o.status}</b>{o.status === 'collected' ? ' — thanks for picking up!' : '. Stock was restored where applicable.'}</span>
        </div>
      )}

      <div className="card p-5 mt-4">
        <h2 className="font-display font-bold text-lg">Items</h2>
        {o.items.map((i: any) => (
          <div key={i.id} className="flex justify-between gap-3 text-sm py-2 border-b border-line/70 last:border-0">
            <span className="min-w-0">{i.product_name_snapshot} × {i.quantity} {i.unit_snapshot} @ ₹{Number(i.unit_price_snapshot).toFixed(2)}</span>
            <b className="shrink-0">₹{Number(i.line_total).toFixed(2)}</b>
          </div>
        ))}
        <div className="text-sm mt-3 space-y-1">
          <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>₹{Number(o.subtotal).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Delivery</span><span>{Number(o.delivery_fee) === 0 ? <b className="text-farm">FREE</b> : `₹${Number(o.delivery_fee).toFixed(2)}`}</span></div>
          <div className="flex justify-between font-extrabold text-lg"><span>Total</span><span>₹{Number(o.total_amount).toFixed(2)}</span></div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-4 no-print">
        {(isSeller || user?.role === 'admin') && (NEXT[o.status] || []).map((n) => (
          <button key={n} disabled={act.isPending} onClick={() => {
            if (['rejected', 'cancelled'].includes(n) && !confirm(`Mark as ${n}?`)) return
            const url = n === 'accepted' ? `/orders/${o.id}/accept` : n === 'rejected' ? `/orders/${o.id}/reject` : `/orders/${o.id}/status`
            act.mutate({ url, body: n.startsWith('accept') || n.startsWith('reject') ? {} : { status: n } })
          }} className={n === 'rejected' ? 'btn-secondary' : 'btn-primary'}>
            {n === 'accepted' ? 'Accept order' : n === 'rejected' ? 'Reject' : `Mark: ${n === 'dispatched' ? 'out for delivery' : n}`}
          </button>
        ))}
        {!isSeller && ['placed', 'accepted'].includes(o.status) && (
          <button disabled={act.isPending} onClick={() => { if (confirm('Cancel this order?')) act.mutate({ url: `/orders/${o.id}/cancel` }) }}
            className="btn-secondary">Cancel order</button>
        )}
      </div>

      {/* Review */}
      {!isSeller && ['delivered', 'collected'].includes(o.status) && o.items?.[0] && (
        <div className="card p-5 mt-4 no-print">
          <h2 className="font-display font-bold text-lg">Rate your purchase</h2>
          <div className="flex gap-2 mt-3 items-center flex-wrap">
            <select value={review.rating} onChange={(e) => setReview({ ...review, rating: Number(e.target.value) })} className="input !w-28" aria-label="Rating">
              {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} ★</option>)}
            </select>
            <input value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} placeholder="Fresh and fairly priced…" className="input flex-1 min-w-40" />
            <button onClick={() => submitReview(o.items[0].product_id)} className="btn-primary">Submit</button>
          </div>
          <p className="text-xs text-muted mt-2">Only buyers with completed orders can review.</p>
          <div className="mt-1"><Stars avg={review.rating} /></div>
        </div>
      )}
    </div>
  )
}
