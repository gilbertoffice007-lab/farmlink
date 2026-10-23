import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertTriangle, ArrowRight, CheckCircle2, MapPin, PackagePlus, Plus, Route, Search, Sparkles, Truck, X,
} from 'lucide-react'
import { api, apiError } from '../lib/api'
import { queryClient } from '../lib/query-client'
import { Empty, ErrorBox, StatusBadge } from '../components/common/ui'
import { SpeakButton } from '../components/voice/SpeakButton'

function fmt(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultWindow() {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(8, 0, 0, 0)
  const end = new Date(start)
  end.setHours(12, 0, 0, 0)
  const deadline = new Date(start)
  deadline.setDate(deadline.getDate() + 1)
  deadline.setHours(18, 0, 0, 0)
  return { start: toLocalInput(start), end: toLocalInput(end), deadline: toLocalInput(deadline) }
}

const BLANK = {
  title: '', pickup_location: '', pickup_area: '', delivery_location: '', delivery_area: '',
  pickup_window_start: defaultWindow().start, pickup_window_end: defaultWindow().end,
  delivery_deadline: defaultWindow().deadline, capacity: '', capacity_unit: 'kg',
  handling: 'fresh_produce', cost_basis: 'weight', estimated_cost: '', vehicle_note: '', notes: '', publish: true,
}

const HANDLING_LABEL: Record<string, string> = {
  fresh_produce: 'Fresh produce', dry_goods: 'Dry goods', fragile: 'Fragile', mixed: 'Mixed loads',
}

export function shipmentSpeech(s: any) {
  return [
    `${s.title}.`,
    `From ${s.pickup_location} to ${s.delivery_location}.`,
    `${s.remaining_capacity} ${s.capacity_unit} of ${s.capacity} ${s.capacity_unit} capacity remaining.`,
    `Status ${s.status.replace(/_/g, ' ')}.`,
    `Pickup window ${fmt(s.pickup_window_start)} to ${fmt(s.pickup_window_end)}, delivery deadline ${fmt(s.delivery_deadline)}.`,
    s.cost?.estimated_cost != null ? `Estimated transport cost ${s.cost.estimated_cost} rupees.` : 'No transport cost estimate has been entered.',
    'Area matching uses text only; no distance or travel time is claimed.',
  ].join(' ')
}

export default function SharedTransport() {
  const [openForm, setOpenForm] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({ ...BLANK })
  const [filters, setFilters] = useState({ status: 'open', pickup_area: '', delivery_area: '', min_capacity: '', handling: '' })
  const [matchFilters, setMatchFilters] = useState({ pickup_area: '', delivery_area: '', quantity: '', handling: 'fresh_produce' })
  const [matchReady, setMatchReady] = useState(false)

  const shipments = useQuery({
    queryKey: ['shipments', filters],
    queryFn: async () => (await api.get('/transport/shipments', {
      params: {
        status: filters.status,
        pickup_area: filters.pickup_area || undefined,
        delivery_area: filters.delivery_area || undefined,
        min_capacity: filters.min_capacity || undefined,
        handling: filters.handling || undefined,
        page_size: 24,
      },
    })).data,
  })
  const mine = useQuery({ queryKey: ['shipments-mine'], queryFn: async () => (await api.get('/transport/shipments/mine')).data })
  const matches = useQuery({
    queryKey: ['shipment-matches', matchFilters],
    enabled: matchReady,
    queryFn: async () => (await api.get('/transport/matches', {
      params: {
        pickup_area: matchFilters.pickup_area,
        delivery_area: matchFilters.delivery_area,
        quantity: matchFilters.quantity,
        handling: matchFilters.handling,
        limit: 8,
      },
    })).data,
  })

  const create = useMutation({
    mutationFn: async () => (await api.post('/transport/shipments', {
      ...form,
      capacity: Number(form.capacity),
      estimated_cost: form.estimated_cost === '' ? undefined : String(form.estimated_cost),
      pickup_window_start: new Date(form.pickup_window_start).toISOString(),
      pickup_window_end: new Date(form.pickup_window_end).toISOString(),
      delivery_deadline: new Date(form.delivery_deadline).toISOString(),
      pickup_area: form.pickup_area || undefined,
      delivery_area: form.delivery_area || undefined,
      vehicle_note: form.vehicle_note || undefined,
      notes: form.notes || undefined,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      queryClient.invalidateQueries({ queryKey: ['shipments-mine'] })
      toast.success('Shared shipment created')
      setOpenForm(false)
      setForm({ ...BLANK })
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const active = useMemo(() => (Array.isArray(mine.data) ? mine.data.filter((s: any) => !['delivered', 'cancelled', 'failed'].includes(s.status)) : []), [mine.data])

  const submit = () => {
    if (!form.title || !form.pickup_location || !form.delivery_location) return toast.error('Add a title, pickup location and destination.')
    if (!form.capacity || Number(form.capacity) <= 0) return toast.error('Enter a capacity above zero.')
    if (new Date(form.pickup_window_end) <= new Date(form.pickup_window_start)) return toast.error('Pickup window end must be after its start.')
    if (new Date(form.delivery_deadline) < new Date(form.pickup_window_start)) return toast.error('Delivery deadline cannot be before pickup starts.')
    if (!confirm('Create this shared shipment? Other members will be able to request space.')) return
    create.mutate()
  }

  const findMatches = () => {
    if (matchFilters.pickup_area.trim().length < 2 || matchFilters.delivery_area.trim().length < 2) {
      toast.error('Enter at least two characters for pickup and delivery areas.')
      return
    }
    if (!matchFilters.quantity || Number(matchFilters.quantity) <= 0) {
      toast.error('Enter the quantity you need to move.')
      return
    }
    setMatchReady(true)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <section className="rounded-3xl bg-gradient-to-br from-forest to-pine text-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <span className="badge bg-lime/20 text-lime border border-lime/30"><Truck size={13} /> Shared Transport Fill-Up</span>
            <h1 className="font-display font-black text-3xl sm:text-4xl mt-3">Share a load. Split the cost transparently.</h1>
            <p className="text-white/75 text-sm mt-2">
              Combine compatible pickups and deliveries in the same area. Capacity is reserved atomically, and every
              contribution is calculated from the cost and sharing basis entered by the shipment owner.
            </p>
            <p className="text-white/55 text-xs mt-2">No GPS distance, travel time or guaranteed saving is invented.</p>
          </div>
          <button className="btn-gold !py-2.5 text-sm" onClick={() => setOpenForm(true)}><Plus size={16} /> Create shipment</button>
        </div>
      </section>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 mt-6">
        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="font-display font-bold text-lg flex items-center gap-2"><Search size={17} className="text-farm" /> Browse open loads</h2>
            <div className="space-y-3 mt-3">
              <div>
                <label className="label" htmlFor="tr-status">Status</label>
                <select id="tr-status" className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  <option value="open">Open</option>
                  <option value="filled">Filled</option>
                  <option value="pickup_scheduled">Pickup scheduled</option>
                  <option value="in_transit">In transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tr-pickup">Pickup area</label>
                <input id="tr-pickup" className="input" value={filters.pickup_area} onChange={(e) => setFilters({ ...filters, pickup_area: e.target.value })} placeholder="Erode" />
              </div>
              <div>
                <label className="label" htmlFor="tr-delivery">Destination area</label>
                <input id="tr-delivery" className="input" value={filters.delivery_area} onChange={(e) => setFilters({ ...filters, delivery_area: e.target.value })} placeholder="Chennai" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="tr-capacity">Min capacity</label>
                  <input id="tr-capacity" type="number" min="0" className="input" value={filters.min_capacity} onChange={(e) => setFilters({ ...filters, min_capacity: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="tr-handling">Handling</label>
                  <select id="tr-handling" className="input" value={filters.handling} onChange={(e) => setFilters({ ...filters, handling: e.target.value })}>
                    <option value="">Any</option>
                    {Object.entries(HANDLING_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-display font-bold text-lg flex items-center gap-2"><Sparkles size={17} className="text-farm" /> Find compatible loads</h2>
            <p className="text-xs text-muted mt-1">Text areas, capacity, handling and time windows. No distance estimate.</p>
            <div className="space-y-2.5 mt-3">
              <input aria-label="Match pickup area" className="input" placeholder="Pickup area" value={matchFilters.pickup_area} onChange={(e) => { setMatchFilters({ ...matchFilters, pickup_area: e.target.value }); setMatchReady(false) }} />
              <input aria-label="Match destination area" className="input" placeholder="Destination area" value={matchFilters.delivery_area} onChange={(e) => { setMatchFilters({ ...matchFilters, delivery_area: e.target.value }); setMatchReady(false) }} />
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Quantity to move" type="number" min="0" className="input" placeholder="Quantity" value={matchFilters.quantity} onChange={(e) => { setMatchFilters({ ...matchFilters, quantity: e.target.value }); setMatchReady(false) }} />
                <select aria-label="Handling requirement" className="input" value={matchFilters.handling} onChange={(e) => { setMatchFilters({ ...matchFilters, handling: e.target.value }); setMatchReady(false) }}>
                  {Object.entries(HANDLING_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
              <button className="btn-primary w-full !py-2.5 text-sm" onClick={findMatches}>Find matches</button>
            </div>
            {matchReady && matches.isFetching && <p className="text-sm text-muted mt-3">Comparing loads…</p>}
            {matchReady && matches.isError && <div className="mt-3"><ErrorBox message={apiError(matches.error)} onRetry={() => matches.refetch()} /></div>}
            {matchReady && matches.data?.matches?.length === 0 && <p className="text-sm text-muted mt-3">No fully compatible loads found. Try another area or remove one criterion.</p>}
            <div className="space-y-2 mt-3">
              {(matches.data?.matches || []).map((m: any) => (
                <div key={m.shipment.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/transport/${m.shipment.id}`} className="font-bold text-sm hover:text-farm">{m.shipment.title}</Link>
                    <span className="badge bg-farm-light text-farm">{m.score}%</span>
                  </div>
                  <div className="text-xs text-muted">{m.shipment.pickup_area} → {m.shipment.delivery_area} · {m.shipment.remaining_capacity} {m.shipment.capacity_unit} left</div>
                  {m.match_reasons.map((r: string) => <div key={r} className="text-[11px] text-green-800 mt-1 flex gap-1"><CheckCircle2 size={11} className="mt-0.5 shrink-0" />{r}</div>)}
                  {m.warnings.map((w: string) => <div key={w} className="text-[11px] text-amber-800 mt-1 flex gap-1"><AlertTriangle size={11} className="mt-0.5 shrink-0" />{w}</div>)}
                </div>
              ))}
            </div>
            {matchReady && matches.data?.method && <p className="text-[11px] text-muted mt-2">{matches.data.method}</p>}
          </div>
        </aside>

        <div>
          {active.length > 0 && (
            <section aria-labelledby="my-shipments">
              <h2 id="my-shipments" className="font-display font-black text-2xl text-forest">Your active shipments</h2>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                {active.slice(0, 4).map((s: any) => (
                  <Link key={s.id} to={`/transport/${s.id}`} className="card card-hover p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <b>{s.title}</b><StatusBadge status={s.status} />
                      {s.is_owner && <span className="badge bg-farm-light text-farm">owner</span>}
                    </div>
                    <div className="text-xs text-muted mt-1">{s.pickup_area} → {s.delivery_area} · {s.remaining_capacity} {s.capacity_unit} left</div>
                    <div className="text-xs text-muted mt-1">Pickup {fmt(s.pickup_window_start)} · {s.participant_count} participant{s.participant_count === 1 ? '' : 's'}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap mt-6">
            <h2 className="font-display font-black text-2xl text-forest">Available shared loads</h2>
            <button className="btn-secondary !py-2.5 text-sm" onClick={() => shipments.refetch()}>Refresh</button>
          </div>
          {shipments.isLoading && <p className="text-sm text-muted mt-3">Loading shipments…</p>}
          {shipments.isError && <div className="mt-3"><ErrorBox message={apiError(shipments.error)} onRetry={() => shipments.refetch()} /></div>}
          {shipments.data?.items?.length === 0 && <div className="mt-3"><Empty title="No shared loads in this view" hint="Create one, or widen the area and status filters." action={<button className="btn-primary" onClick={() => setOpenForm(true)}>Create shipment</button>} /></div>}
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            {(shipments.data?.items || []).map((s: any) => (
              <article key={s.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display font-bold text-lg">{s.title}</h3>
                    <div className="text-xs text-muted">{s.owner_farm || s.owner_name} · {HANDLING_LABEL[s.handling] || s.handling}</div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-2 text-sm flex items-center gap-1.5"><MapPin size={14} className="text-farm" /> {s.pickup_area} → {s.delivery_area}</div>
                <div className="text-xs text-muted mt-1">Full route: {s.pickup_location} to {s.delivery_location}</div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div className="rounded-lg bg-cream/70 p-2"><div className="text-muted">Capacity left</div><b>{s.remaining_capacity} / {s.capacity} {s.capacity_unit}</b></div>
                  <div className="rounded-lg bg-cream/70 p-2"><div className="text-muted">Estimated cost</div><b>{s.cost?.estimated_cost != null ? `₹${Number(s.cost.estimated_cost).toFixed(2)}` : 'Not entered'}</b></div>
                </div>
                <div className="text-xs text-muted mt-2">
                  Pickup window: {fmt(s.pickup_window_start)} – {fmt(s.pickup_window_end)}<br />
                  Delivery deadline: {fmt(s.delivery_deadline)}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Link to={`/transport/${s.id}`} className="btn-primary !px-3.5 !py-2 text-sm">View & join <ArrowRight size={14} /></Link>
                  <SpeakButton text={shipmentSpeech(s)} label="Listen" compact />
                </div>
              </article>
            ))}
          </div>
          {shipments.data?.pages > 1 && (
            <p className="text-xs text-muted mt-3">Showing {shipments.data.items.length} of {shipments.data.total}. Refine the area filters to narrow results.</p>
          )}
        </div>
      </div>

      {openForm && (
        <div className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="shipment-form-title">
          <div className="absolute inset-0 bg-pine/55 backdrop-blur-sm" onClick={() => setOpenForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-lift w-full max-w-2xl max-h-[94vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-line px-5 py-4 flex items-center justify-between gap-3 z-10">
              <h2 id="shipment-form-title" className="font-display font-black text-xl">Create shared shipment</h2>
              <button className="p-2 rounded-lg hover:bg-cream" aria-label="Close shipment form" onClick={() => setOpenForm(false)}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label" htmlFor="sh-title">Shipment title</label>
                <input id="sh-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Erode to Chennai vegetable run" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="sh-pickup">Pickup location</label>
                  <input id="sh-pickup" className="input" value={form.pickup_location} onChange={(e) => setForm({ ...form, pickup_location: e.target.value })} placeholder="Village / town" />
                </div>
                <div>
                  <label className="label" htmlFor="sh-pickup-area">Pickup area (match text)</label>
                  <input id="sh-pickup-area" className="input" value={form.pickup_area} onChange={(e) => setForm({ ...form, pickup_area: e.target.value })} placeholder="Erode" />
                </div>
                <div>
                  <label className="label" htmlFor="sh-delivery">Destination</label>
                  <input id="sh-delivery" className="input" value={form.delivery_location} onChange={(e) => setForm({ ...form, delivery_location: e.target.value })} placeholder="Market / city" />
                </div>
                <div>
                  <label className="label" htmlFor="sh-delivery-area">Destination area (match text)</label>
                  <input id="sh-delivery-area" className="input" value={form.delivery_area} onChange={(e) => setForm({ ...form, delivery_area: e.target.value })} placeholder="Chennai" />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="label" htmlFor="sh-start">Pickup window start</label>
                  <input id="sh-start" type="datetime-local" className="input" value={form.pickup_window_start} onChange={(e) => setForm({ ...form, pickup_window_start: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="sh-end">Pickup window end</label>
                  <input id="sh-end" type="datetime-local" className="input" value={form.pickup_window_end} onChange={(e) => setForm({ ...form, pickup_window_end: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="sh-deadline">Delivery deadline</label>
                  <input id="sh-deadline" type="datetime-local" className="input" value={form.delivery_deadline} onChange={(e) => setForm({ ...form, delivery_deadline: e.target.value })} />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="label" htmlFor="sh-capacity">Capacity</label>
                  <input id="sh-capacity" type="number" min="0.01" step="0.01" className="input" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="sh-unit">Capacity unit</label>
                  <select id="sh-unit" className="input" value={form.capacity_unit} onChange={(e) => setForm({ ...form, capacity_unit: e.target.value })}>
                    {['kg', 'ton', 'quintal', 'bag', 'piece', 'litre'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="sh-handling">Handling</label>
                  <select id="sh-handling" className="input" value={form.handling} onChange={(e) => setForm({ ...form, handling: e.target.value })}>
                    {Object.entries(HANDLING_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="sh-basis">Cost sharing basis</label>
                  <select id="sh-basis" className="input" value={form.cost_basis} onChange={(e) => setForm({ ...form, cost_basis: e.target.value })}>
                    <option value="weight">By quantity / weight</option>
                    <option value="volume">By volume</option>
                    <option value="equal">Split equally</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="sh-cost">Estimated total cost ₹ (optional)</label>
                  <input id="sh-cost" type="number" min="0" step="0.01" className="input" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} placeholder="Enter only a real quote" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="sh-vehicle">Vehicle note (optional)</label>
                <input id="sh-vehicle" className="input" value={form.vehicle_note} onChange={(e) => setForm({ ...form, vehicle_note: e.target.value })} placeholder="e.g. 1.5 tonne mini truck" />
              </div>
              <div>
                <label className="label" htmlFor="sh-notes">Notes (optional)</label>
                <textarea id="sh-notes" rows={2} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} className="accent-[#28784A] w-4 h-4" />
                Publish now so other members can join
              </label>
              <div className="rounded-xl bg-cream border border-line p-3 text-xs text-muted">
                Cost shares use the cost you enter. FarmLink does not estimate distances, fuel, tolls or guaranteed savings.
                Leave the cost empty if you do not have a real quote.
              </div>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={create.isPending} onClick={submit}>{create.isPending ? 'Creating…' : 'Create shipment'}</button>
                <button className="btn-secondary" onClick={() => setOpenForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
