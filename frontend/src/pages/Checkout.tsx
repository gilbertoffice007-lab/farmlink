import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { MapPin, Truck, Store, CalendarClock, MessageSquare, Trash2, Plus } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { queryClient } from '../lib/query-client'
import { Empty } from '../components/common/ui'

export default function Checkout() {
  const nav = useNavigate()
  const [done, setDone] = useState<any[]>([])
  const [showAddr, setShowAddr] = useState(false)
  const { data: cart } = useQuery({ queryKey: ['cart'], queryFn: async () => (await api.get('/cart')).data })
  const { data: addrs } = useQuery({ queryKey: ['addrs'], queryFn: async () => (await api.get('/addresses')).data })
  const { data: policy } = useQuery({ queryKey: ['delivery-policy'], queryFn: async () => (await api.get('/orders/delivery/policy')).data })
  const { register, handleSubmit, watch } = useForm<any>({ defaultValues: { fulfillment_type: 'delivery', payment_method: 'cod', delivery_slot: 'tomorrow_morning' } })
  const [addrId, setAddrId] = useState<number | null>(null)
  const fulfillment = watch('fulfillment_type')

  const order = useMutation({
    mutationFn: async (v: any) => (await api.post('/orders', {
      delivery_address_id: v.fulfillment_type === 'pickup' ? null : (addrId || addrs?.[0]?.id),
      fulfillment_type: v.fulfillment_type, payment_method: v.payment_method, buyer_notes: v.buyer_notes,
      delivery_slot: v.fulfillment_type === 'delivery' ? v.delivery_slot : null,
      delivery_instructions: v.delivery_instructions || null,
    })).data,
    onSuccess: (orders) => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      setDone(orders)
      toast.success('Order placed!')
    },
    onError: (e: any) => toast.error(apiError(e))
  })

  const addAddr = useMutation({
    mutationFn: async (v: any) => (await api.post('/addresses', v)).data,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['addrs'] })
      if (created?.id) setAddrId(created.id)
      setShowAddr(false)
      toast.success('Address saved — selected for this order')
    },
    onError: (e: any) => toast.error(apiError(e))
  })
  const delAddr = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/addresses/${id}`)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['addrs'] }); toast.success('Address removed') },
    onError: (e: any) => toast.error(apiError(e))
  })

  if (done.length) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="text-6xl">🎉</div>
        <h1 className="font-display font-black text-3xl text-forest mt-3">Order confirmed!</h1>
        <p className="text-muted text-sm mt-1">Track packing, dispatch and delivery live.</p>
        {done.map((o: any) => (
          <div key={o.id} className="card p-4 mt-3 text-left card-hover">
            <div className="font-bold">{o.order_number}</div>
            <div className="text-sm text-muted">₹{Number(o.total_amount).toFixed(2)} · {o.fulfillment_type === 'pickup' ? 'Farm pickup' : `Delivery · slot ${o.delivery_slot || 'standard'}`} · {o.payment_method === 'cod' ? 'Cash on Delivery' : 'Simulated online (demo)'}</div>
            <Link to={`/orders/${o.id}`} className="text-farm font-semibold text-sm">Track order →</Link>
          </div>
        ))}
        <button onClick={() => nav('/orders')} className="btn-primary mt-6">View all orders</button>
      </div>
    )
  }

  if (!cart?.items?.length) return <div className="max-w-xl mx-auto p-4 py-10"><Empty title="Nothing to check out" action={<Link to="/market" className="btn-primary">Browse produce</Link>} /></div>

  const sub = Number(cart.subtotal)
  const FREE_MIN = policy?.free_delivery_min_subtotal ?? 499
  const FEE = policy?.delivery_fee ?? 40
  const freeShip = fulfillment === 'pickup' || sub >= FREE_MIN
  const progress = Math.min(100, (sub / FREE_MIN) * 100)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-display font-black text-3xl text-forest">Checkout</h1>

      {!freeShip && fulfillment === 'delivery' && (
        <div className="card p-4 mt-4 border-farm/30 bg-gradient-to-r from-farm-light/60 to-white">
          <div className="text-sm"><b>Add ₹{(FREE_MIN - sub).toFixed(0)} more</b> for <b className="text-farm">FREE delivery</b> <span className="text-muted">(₹{FREE_MIN}+ per seller order)</span></div>
          <div className="h-2.5 rounded-full bg-line/70 mt-2 overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to free delivery">
            <div className="h-full rounded-full bg-gradient-to-r from-leaf to-farm transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {freeShip && (
        <div className="card p-4 mt-4 border-farm/40 bg-farm-light/50 text-sm font-semibold text-farm">🎉 You’ve unlocked FREE delivery on this order!</div>
      )}

      <div className="grid lg:grid-cols-[1fr_330px] gap-6 mt-5">
        <form onSubmit={handleSubmit((v) => order.mutate(v))} className="space-y-4">
          {/* Fulfillment */}
          <div className="card p-5">
            <h2 className="font-bold flex items-center gap-2"><Truck size={17} className="text-farm" /> How do you want it?</h2>
            <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
              <label className="border rounded-2xl p-4 cursor-pointer has-[:checked]:border-farm has-[:checked]:ring-2 has-[:checked]:ring-farm/20 has-[:checked]:bg-farm-light/30 transition">
                <input type="radio" value="delivery" {...register('fulfillment_type')} className="accent-[#28784A]" />
                <div className="font-bold mt-1">Home delivery</div>
                <div className="text-xs text-muted">{freeShip ? 'FREE (₹499+)' : `₹${FEE} per seller order`} · ~2 days</div>
              </label>
              <label className="border rounded-2xl p-4 cursor-pointer has-[:checked]:border-farm has-[:checked]:ring-2 has-[:checked]:ring-farm/20 has-[:checked]:bg-farm-light/30 transition">
                <input type="radio" value="pickup" {...register('fulfillment_type')} className="accent-[#28784A]" />
                <div className="font-bold mt-1 flex items-center gap-1.5"><Store size={14} /> Farm pickup</div>
                <div className="text-xs text-muted">Always free · ready next day</div>
              </label>
            </div>

            {fulfillment === 'delivery' && (
              <div className="mt-4">
                <div className="font-bold text-sm flex items-center gap-2"><CalendarClock size={15} className="text-farm" /> Choose a delivery slot</div>
                <div className="grid sm:grid-cols-2 gap-2 mt-2">
                  {(policy?.slots || []).map((s: any) => (
                    <label key={s.id} className="border rounded-xl px-3.5 py-2.5 text-sm cursor-pointer has-[:checked]:border-farm has-[:checked]:ring-2 has-[:checked]:ring-farm/20 has-[:checked]:bg-farm-light/30 transition">
                      <input type="radio" value={s.id} {...register('delivery_slot')} className="accent-[#28784A] mr-2" />{s.label}
                    </label>
                  ))}
                </div>
                <label className="block text-sm mt-3 font-semibold"><span className="inline-flex items-center gap-1.5"><MessageSquare size={14} /> Delivery instructions</span>
                  <textarea {...register('delivery_instructions')} className="input mt-1.5 font-normal" rows={2} placeholder="e.g. 2nd floor, call on arrival, leave with watchman" maxLength={500} /></label>
              </div>
            )}
          </div>

          {/* Address */}
          {fulfillment === 'delivery' && (
            <div className="card p-5">
              <div className="flex justify-between items-center">
                <h2 className="font-bold flex items-center gap-2"><MapPin size={17} className="text-farm" /> Delivery address</h2>
                <button type="button" onClick={() => setShowAddr(!showAddr)} className="btn-secondary !px-3 !py-1.5 text-sm inline-flex items-center gap-1"><Plus size={14} /> New</button>
              </div>
              {(addrs || []).length === 0 && <p className="text-sm text-muted mt-2">No address yet — add one to continue.</p>}
              <div className="space-y-2 mt-3">
                {(addrs || []).map((a: any) => (
                  <div key={a.id} className="flex gap-2 items-start border border-line rounded-2xl p-3.5 text-sm has-[:checked]:border-farm has-[:checked]:bg-farm-light/20 transition">
                    <input type="radio" name="addr" checked={addrId === a.id || (!addrId && a.is_default)} onChange={() => setAddrId(a.id)} className="accent-[#28784A] mt-1" aria-label={`Deliver to ${a.recipient_name}`} />
                    <span className="flex-1"><b>{a.recipient_name}</b> · {a.phone}<br /><span className="text-muted">{a.address_line}, {a.city}, {a.state} {a.postal_code}</span></span>
                    <button type="button" aria-label="Delete address" onClick={() => { if (confirm('Delete this address?')) delAddr.mutate(a.id) }} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
              {showAddr && <NewAddressForm onSave={(v) => addAddr.mutate(v)} saving={addAddr.isPending} />}
            </div>
          )}

          {/* Payment */}
          <div className="card p-5 space-y-3">
            <h2 className="font-bold">Payment</h2>
            <div className="grid sm:grid-cols-2 gap-2.5">
              <label className="border rounded-2xl p-4 cursor-pointer has-[:checked]:border-farm has-[:checked]:ring-2 has-[:checked]:ring-farm/20 transition text-sm">
                <input type="radio" value="cod" {...register('payment_method')} className="accent-[#28784A] mr-2" />
                <b>Cash on Delivery</b><div className="text-xs text-muted ml-6">Pay when it arrives</div>
              </label>
              <label className="border rounded-2xl p-4 cursor-pointer has-[:checked]:border-farm has-[:checked]:ring-2 has-[:checked]:ring-farm/20 transition text-sm">
                <input type="radio" value="online_mock" {...register('payment_method')} className="accent-[#28784A] mr-2" />
                <b>Online <span className="badge bg-amber-100 text-amber-800 ml-1">simulated</span></b><div className="text-xs text-muted ml-6">Demo only — no real charge</div>
              </label>
            </div>
            <label className="block text-sm font-semibold">Notes for seller (optional)
              <textarea {...register('buyer_notes')} className="input mt-1.5 font-normal" rows={2} placeholder="Anything the farmer should know" /></label>
          </div>

          <button className="btn-primary w-full !py-3.5 text-base" disabled={order.isPending}>{order.isPending ? 'Placing your order…' : 'Confirm order'}</button>
          <p className="text-xs text-muted text-center">Server recalculates prices, stock and delivery fees — what you see is what the farmer gets.</p>
        </form>

        <aside className="card p-5 h-fit lg:sticky lg:top-24">
          <h2 className="font-display font-bold text-lg">Order summary</h2>
          <div className="mt-2 max-h-56 overflow-auto">
            {cart.items.map((i: any) => <div key={i.id} className="flex justify-between text-sm py-1 border-b border-line/60 last:border-0"><span>{i.product_name} × {i.quantity}</span><b>₹{Number(i.line_total).toFixed(2)}</b></div>)}
          </div>
          <div className="border-t border-line mt-3 pt-3 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-muted">Subtotal</span><b>₹{sub.toFixed(2)}</b></div>
            <div className="flex justify-between"><span className="text-muted">Delivery</span>{freeShip ? <b className="text-farm">FREE</b> : <span>₹{FEE} / seller order*</span>}</div>
            <div className="flex justify-between font-extrabold text-lg pt-1"><span>Total</span><span>₹{(sub + (freeShip ? 0 : FEE)).toFixed(2)}{!freeShip && '+'}</span></div>
            <p className="text-[11px] text-muted">* Final fee computed per seller on the server. Multi-seller carts split into separate tracked orders.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function NewAddressForm({ onSave, saving }: { onSave: (v: any) => void; saving: boolean }) {
  // NOTE: plain <div>, not <form> — this sits inside the checkout <form>
  // and nested forms are invalid HTML (submit would place the order!).
  const { register, handleSubmit, formState: { errors } } = useForm<any>()
  const req = { required: 'Required' } as const
  return (
    <div className="grid sm:grid-cols-2 gap-2 mt-3 bg-cream rounded-2xl p-3">
      <div><input placeholder="Recipient name *" aria-label="Recipient name" className="input" {...register('recipient_name', req)} />
        {errors.recipient_name && <p className="text-xs text-red-600 mt-1">Required</p>}</div>
      <div><input placeholder="Phone *" aria-label="Phone" className="input" {...register('phone', req)} />
        {errors.phone && <p className="text-xs text-red-600 mt-1">Required</p>}</div>
      <div className="sm:col-span-2"><input placeholder="Street address *" aria-label="Street address" className="input" {...register('address_line', req)} />
        {errors.address_line && <p className="text-xs text-red-600 mt-1">Required</p>}</div>
      <div><input placeholder="City *" aria-label="City" className="input" {...register('city', req)} />
        {errors.city && <p className="text-xs text-red-600 mt-1">Required</p>}</div>
      <div><input placeholder="State *" aria-label="State" className="input" {...register('state', req)} />
        {errors.state && <p className="text-xs text-red-600 mt-1">Required</p>}</div>
      <div className="sm:col-span-2"><input placeholder="Postal code *" aria-label="Postal code" className="input" {...register('postal_code', req)} />
        {errors.postal_code && <p className="text-xs text-red-600 mt-1">Required</p>}</div>
      <button type="button" className="btn-primary sm:col-span-2" disabled={saving}
        onClick={handleSubmit((v) => onSave({ ...v, is_default: true }))}>{saving ? 'Saving…' : 'Save & use this address'}</button>
    </div>
  )
}
