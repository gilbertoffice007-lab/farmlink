import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, MapPin, PackagePlus, Truck, Users,
} from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { queryClient } from '../lib/query-client'
import { ErrorBox, StatusBadge } from '../components/common/ui'
import { SpeakButton } from '../components/voice/SpeakButton'
import { shipmentSpeech } from './SharedTransport'

function fmt(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

const NEXT_ACTIONS: Record<string, Array<{ status: string; label: string; danger?: boolean }>> = {
  draft: [{ status: 'open', label: 'Publish shipment' }, { status: 'cancelled', label: 'Cancel', danger: true }],
  open: [{ status: 'closed', label: 'Close to new loads' }, { status: 'cancelled', label: 'Cancel shipment', danger: true }],
  filled: [{ status: 'pickup_scheduled', label: 'Schedule pickup' }, { status: 'closed', label: 'Close' }, { status: 'cancelled', label: 'Cancel', danger: true }],
  closed: [{ status: 'pickup_scheduled', label: 'Schedule pickup' }, { status: 'cancelled', label: 'Cancel', danger: true }],
  pickup_scheduled: [{ status: 'in_transit', label: 'Mark in transit' }, { status: 'failed', label: 'Mark failed', danger: true }, { status: 'cancelled', label: 'Cancel', danger: true }],
  in_transit: [{ status: 'delivered', label: 'Mark delivered' }, { status: 'failed', label: 'Mark failed', danger: true }],
  delivered: [],
  cancelled: [],
  failed: [],
}

export default function ShipmentDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const [join, setJoin] = useState({ quantity: '', volume: '', ref_type: 'manual', ref_id: '', notes: '' })
  const [cost, setCost] = useState({ estimated: '', final: '', basis: 'weight' })

  const shipment = useQuery({ queryKey: ['shipment', id], queryFn: async () => (await api.get(`/transport/shipments/${id}`)).data })
  const orders = useQuery({ queryKey: ['orders'], queryFn: async () => (await api.get('/orders')).data })

  useEffect(() => {
    if (!shipment.data) return
    setCost({
      estimated: shipment.data.cost?.estimated_cost != null ? String(shipment.data.cost.estimated_cost) : '',
      final: shipment.data.cost?.final_cost != null ? String(shipment.data.cost.final_cost) : '',
      basis: shipment.data.cost?.cost_basis || shipment.data.cost_basis || 'weight',
    })
  }, [shipment.data?.id, shipment.data?.cost?.estimated_cost, shipment.data?.cost?.final_cost])

  const joinMut = useMutation({
    mutationFn: async () => (await api.post(`/transport/shipments/${id}/join`, {
      quantity: Number(join.quantity),
      volume: join.volume === '' ? undefined : Number(join.volume),
      ref_type: join.ref_type,
      ref_id: join.ref_type === 'order' ? join.ref_id : undefined,
      notes: join.notes || undefined,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment', id] })
      queryClient.invalidateQueries({ queryKey: ['shipments-mine'] })
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      toast.success('Capacity reserved. You joined the shared shipment.')
      setJoin({ quantity: '', volume: '', ref_type: 'manual', ref_id: '', notes: '' })
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const leaveMut = useMutation({
    mutationFn: async () => (await api.post(`/transport/shipments/${id}/leave`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment', id] })
      queryClient.invalidateQueries({ queryKey: ['shipments-mine'] })
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      toast.success('You left the shipment. Capacity was released.')
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const statusMut = useMutation({
    mutationFn: async (next: string) => (await api.post(`/transport/shipments/${id}/status`, { status: next })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment', id] })
      queryClient.invalidateQueries({ queryKey: ['shipments-mine'] })
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      toast.success('Shipment status updated')
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const costMut = useMutation({
    mutationFn: async () => (await api.patch(`/transport/shipments/${id}`, {
      cost_basis: cost.basis,
      estimated_cost: cost.estimated === '' ? undefined : String(cost.estimated),
      ...(cost.final !== '' ? { final_cost: String(cost.final) } : {}),
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment', id] })
      toast.success('Cost sharing updated')
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  if (shipment.isLoading) return <div className="max-w-4xl mx-auto p-5"><div className="shimmer h-96" /></div>
  if (shipment.isError || !shipment.data) return <div className="max-w-4xl mx-auto p-5"><ErrorBox message={apiError(shipment.error)} onRetry={() => shipment.refetch()} /></div>

  const s = shipment.data
  const isOwner = s.is_owner
  const actions = NEXT_ACTIONS[s.status] || []
  const canJoin = s.can_join && !isOwner

  const submitJoin = () => {
    if (!join.quantity || Number(join.quantity) <= 0) { toast.error('Enter the quantity you need to move.'); return }
    if (Number(join.quantity) > Number(s.remaining_capacity)) { toast.error(`Only ${s.remaining_capacity} ${s.capacity_unit} capacity remains.`); return }
    if (join.ref_type === 'order' && !join.ref_id) { toast.error('Choose an order to link.'); return }
    if (!confirm(`Reserve ${join.quantity} ${s.capacity_unit} on ${s.title}? This reduces the remaining capacity right away.`)) return
    joinMut.mutate()
  }

  const submitCost = () => {
    if (cost.estimated === '' && cost.final === '') { toast.error('Enter an estimate or a confirmed final cost.'); return }
    if (!confirm('Update the shared cost figures? Participant contributions will be recalculated.')) return
    costMut.mutate()
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <Link to="/transport" className="text-sm font-semibold text-farm inline-flex items-center gap-1.5"><ArrowLeft size={15} /> Back to shared transport</Link>

      <section className="card p-5 sm:p-6 mt-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-black text-2xl sm:text-3xl text-forest">{s.title}</h1>
              <StatusBadge status={s.status} />
              {isOwner && <span className="badge bg-farm-light text-farm">owner</span>}
              {s.is_participant && !isOwner && <span className="badge bg-blue-100 text-blue-800">participant</span>}
            </div>
            <p className="text-sm text-muted mt-1">{s.owner_farm || s.owner_name} · {s.handling.replace(/_/g, ' ')}</p>
          </div>
          <SpeakButton text={shipmentSpeech(s)} label="Read shipment" />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm">
          <div className="rounded-xl bg-cream/70 p-3">
            <div className="text-xs text-muted font-semibold">Route</div>
            <div className="font-bold mt-0.5 flex items-center gap-1"><MapPin size={14} className="text-farm" /> {s.pickup_area} → {s.delivery_area}</div>
            <div className="text-xs text-muted mt-1">{s.pickup_location} → {s.delivery_location}</div>
          </div>
          <div className="rounded-xl bg-cream/70 p-3">
            <div className="text-xs text-muted font-semibold">Capacity</div>
            <div className="font-bold mt-0.5">{s.remaining_capacity} / {s.capacity} {s.capacity_unit}</div>
            <div className="text-xs text-muted mt-1">{s.reserved_capacity} {s.capacity_unit} reserved</div>
          </div>
          <div className="rounded-xl bg-cream/70 p-3">
            <div className="text-xs text-muted font-semibold">Pickup window</div>
            <div className="font-bold mt-0.5">{fmt(s.pickup_window_start)}</div>
            <div className="text-xs text-muted mt-1">to {fmt(s.pickup_window_end)}</div>
          </div>
          <div className="rounded-xl bg-cream/70 p-3">
            <div className="text-xs text-muted font-semibold">Delivery deadline</div>
            <div className="font-bold mt-0.5">{fmt(s.delivery_deadline)}</div>
            <div className="text-xs text-muted mt-1 flex items-center gap-1"><Users size={12} /> {s.participant_count} participant{s.participant_count === 1 ? '' : 's'}</div>
          </div>
        </div>
        {(s.vehicle_note || s.notes) && (
          <div className="text-sm mt-3 space-y-1">
            {s.vehicle_note && <p><b>Vehicle:</b> {s.vehicle_note}</p>}
            {s.notes && <p><b>Notes:</b> {s.notes}</p>}
          </div>
        )}
        <p className="text-xs text-muted mt-3 flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {s.matching_note} Cost shares are based only on the figures entered by the owner.</p>
      </section>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5 mt-5">
        <div>
          <section className="card p-5">
            <h2 className="font-display font-bold text-xl flex items-center gap-2"><Truck size={18} className="text-farm" /> Cost sharing</h2>
            <div className="grid sm:grid-cols-3 gap-3 mt-3 text-sm">
              <div className="rounded-xl bg-cream/60 p-3"><div className="text-xs text-muted">Basis</div><b className="capitalize">{s.cost.cost_basis}</b></div>
              <div className="rounded-xl bg-cream/60 p-3"><div className="text-xs text-muted">Estimated cost</div><b>{s.cost.estimated_cost != null ? `₹${Number(s.cost.estimated_cost).toFixed(2)}` : 'Not entered'}</b></div>
              <div className="rounded-xl bg-cream/60 p-3"><div className="text-xs text-muted">Final cost</div><b>{s.cost.final_cost != null ? `₹${Number(s.cost.final_cost).toFixed(2)}` : 'Not confirmed'}</b></div>
            </div>
            <p className="text-xs text-muted mt-2">{s.cost.note}</p>
            {s.participants?.length ? (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted border-b border-line"><th className="py-2 pr-2">Member</th><th className="py-2 pr-2">Quantity</th><th className="py-2 pr-2">Volume</th><th className="py-2 pr-2">Share</th><th className="py-2 text-right">Contribution</th></tr></thead>
                  <tbody>
                    {s.participants.map((p: any) => (
                      <tr key={p.user_id} className="border-b border-line/60 last:border-0">
                        <td className="py-2 pr-2 font-semibold">{p.user_name}</td>
                        <td className="py-2 pr-2">{p.quantity} {s.capacity_unit}</td>
                        <td className="py-2 pr-2">{p.volume ? `${p.volume}` : '—'}</td>
                        <td className="py-2 pr-2">{p.share_percent}%</td>
                        <td className="py-2 text-right font-bold">{p.contribution != null ? `₹${Number(p.contribution).toFixed(2)}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted mt-3">
                {s.participant_count > 0
                  ? 'Participant names and contribution shares are visible only to the shipment owner and members.'
                  : 'No participants have joined yet. Shares appear when members reserve capacity.'}
              </p>
            )}
            <p className="text-[11px] text-muted mt-2">{s.cost.disclaimer}</p>
          </section>

          {isOwner && !['delivered', 'cancelled', 'failed'].includes(s.status) && (
            <section className="card p-5 mt-4">
              <h2 className="font-display font-bold text-lg">Update cost sharing</h2>
              <p className="text-xs text-muted mt-1">Enter only real quotes. Use the final cost when the transporter confirms it.</p>
              <div className="grid sm:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="label" htmlFor="sc-est">Estimated ₹</label>
                  <input id="sc-est" type="number" min="0" step="0.01" className="input" value={cost.estimated} onChange={(e) => setCost({ ...cost, estimated: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="sc-final">Final ₹</label>
                  <input id="sc-final" type="number" min="0" step="0.01" className="input" value={cost.final} onChange={(e) => setCost({ ...cost, final: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="sc-basis">Basis</label>
                  <select id="sc-basis" className="input" value={cost.basis} onChange={(e) => setCost({ ...cost, basis: e.target.value })}>
                    <option value="weight">Quantity / weight</option>
                    <option value="volume">Volume</option>
                    <option value="equal">Equal split</option>
                  </select>
                </div>
              </div>
              <button className="btn-primary mt-3" disabled={costMut.isPending} onClick={submitCost}>{costMut.isPending ? 'Updating…' : 'Recalculate shares'}</button>
            </section>
          )}

          {isOwner && actions.length > 0 && (
            <section className="card p-5 mt-4">
              <h2 className="font-display font-bold text-lg">Shipment status</h2>
              <p className="text-xs text-muted mt-1">Only valid transitions are offered. Participants are notified of changes.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {actions.map((action) => (
                  <button key={action.status}
                    className={action.danger ? 'btn-secondary !py-2.5 text-sm text-red-600' : 'btn-primary !py-2.5 text-sm'}
                    disabled={statusMut.isPending}
                    onClick={() => {
                      if (['cancelled', 'failed'].includes(action.status) && !confirm(`Mark this shipment ${action.status}? Active participants will be notified.`)) return
                      if (action.status === 'filled' && Number(s.remaining_capacity) > 0) { toast.error('The shipment is not full yet. Use Close to stop accepting loads.'); return }
                      statusMut.mutate(action.status)
                    }}>
                    {action.label}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside>
          {canJoin ? (
            <section className="card p-5">
              <h2 className="font-display font-bold text-xl flex items-center gap-2"><PackagePlus size={18} className="text-farm" /> Join this shipment</h2>
              <p className="text-xs text-muted mt-1">{s.remaining_capacity} {s.capacity_unit} capacity remaining. Space is reserved immediately.</p>
              <div className="space-y-3 mt-3">
                <div>
                  <label className="label" htmlFor="j-qty">Your quantity ({s.capacity_unit})</label>
                  <input id="j-qty" type="number" min="0.01" step="0.01" max={s.remaining_capacity} className="input" value={join.quantity} onChange={(e) => setJoin({ ...join, quantity: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="j-volume">Volume (optional)</label>
                  <input id="j-volume" type="number" min="0" step="0.01" className="input" value={join.volume} onChange={(e) => setJoin({ ...join, volume: e.target.value })} placeholder="Used only if owner shares by volume" />
                </div>
                <div>
                  <label className="label" htmlFor="j-ref">Link to</label>
                  <select id="j-ref" className="input" value={join.ref_type} onChange={(e) => setJoin({ ...join, ref_type: e.target.value, ref_id: '' })}>
                    <option value="manual">No order — manual load</option>
                    <option value="order">One of my orders</option>
                  </select>
                </div>
                {join.ref_type === 'order' && (
                  <div>
                    <label className="label" htmlFor="j-order">Order</label>
                    <select id="j-order" className="input" value={join.ref_id} onChange={(e) => setJoin({ ...join, ref_id: e.target.value })}>
                      <option value="">Choose an order</option>
                      {(Array.isArray(orders.data) ? orders.data : []).map((o: any) => <option key={o.id} value={o.id}>{o.order_number} · ₹{Number(o.total_amount).toFixed(0)}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label" htmlFor="j-notes">Notes (optional)</label>
                  <textarea id="j-notes" rows={2} className="input" value={join.notes} onChange={(e) => setJoin({ ...join, notes: e.target.value })} />
                </div>
                <button className="btn-primary w-full" disabled={joinMut.isPending} onClick={submitJoin}>{joinMut.isPending ? 'Reserving…' : 'Reserve space'}</button>
                <p className="text-[11px] text-muted">Joining does not create payment or a delivery guarantee. Coordinate with the owner using the details shown.</p>
              </div>
            </section>
          ) : (
            <section className="card p-5 text-sm">
              <div className="font-bold flex items-center gap-2"><CheckCircle2 size={17} className="text-farm" /> {s.is_participant ? 'You are in this shipment' : 'Booking status'}</div>
              <p className="text-xs text-muted mt-1">
                {s.is_participant ? `You have active space on this load. ${s.status === 'open' ? 'You can leave while it is still open.' : 'The owner has moved it beyond open status.'}` : isOwner ? 'You own this shipment.' : `This shipment is ${s.status.replace(/_/g, ' ')} and cannot accept new members right now.`}
              </p>
              {s.can_leave && (
                <button className="btn-secondary w-full mt-3 text-red-600" disabled={leaveMut.isPending}
                  onClick={() => { if (confirm('Leave this shipment and release your reserved capacity?')) leaveMut.mutate() }}>
                  {leaveMut.isPending ? 'Leaving…' : 'Leave shipment'}
                </button>
              )}
            </section>
          )}

          <section className="card p-5 mt-4 text-sm">
            <h2 className="font-bold flex items-center gap-2"><CalendarClock size={17} className="text-farm" /> Good to know</h2>
            <ul className="text-xs text-muted mt-2 space-y-1.5 list-disc list-inside">
              <li>Capacity is reserved atomically, so two people cannot claim the same space.</li>
              <li>Cost shares use the owner's estimate or final cost, whichever is available.</li>
              <li>No savings are guaranteed. Compare the contribution with your own transport quote.</li>
              <li>Area matching is text-based; no GPS distance or travel time is claimed.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
