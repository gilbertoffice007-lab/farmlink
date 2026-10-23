import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertTriangle, CalendarClock, Check, CheckCircle2, Clock, ImagePlus, Leaf, MapPin, Pause, Pencil,
  Play, Plus, Sprout, Timer, Trash2, X,
} from 'lucide-react'
import { api, apiError } from '../lib/api'
import { queryClient } from '../lib/query-client'
import { Empty, ErrorBox, StatusBadge } from '../components/common/ui'
import { SpeakButton } from '../components/voice/SpeakButton'
import { imgFallback } from '../lib/images'

function fmt(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultDeadline() {
  return toLocalInput(new Date(Date.now() + 48 * 3600 * 1000))
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

const BLANK = {
  name: '', description: '', product_id: '', category_id: '', unit: 'kg',
  available_quantity: '', asking_price: '', minimum_price: '',
  harvest_date: todayIso(), pickup_deadline: defaultDeadline(),
  pickup_location: '', condition: '', reason: '', image_url: '',
}

export default function RescueSeller() {
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<Record<string, any>>({ ...BLANK })
  const [uploading, setUploading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const mine = useQuery({
    queryKey: ['rescue-mine'],
    queryFn: async () => (await api.get('/rescue/listings/mine')).data,
    refetchOnWindowFocus: true,
  })
  const products = useQuery({
    queryKey: ['mine'],
    queryFn: async () => (await api.get('/products/mine')).data,
  })
  const offers = useQuery({
    queryKey: ['rescue-listing-offers', expanded],
    enabled: !!expanded,
    queryFn: async () => (await api.get(`/rescue/listings/${expanded}/offers`)).data,
  })
  const matches = useQuery({
    queryKey: ['rescue-listing-matches', expanded],
    enabled: !!expanded,
    queryFn: async () => (await api.get(`/rescue/listings/${expanded}/matches`)).data,
  })

  const scoreByOffer = useMemo(() => {
    const map: Record<string, any> = {}
    for (const match of matches.data?.matches || []) map[match.offer.id] = match
    return map
  }, [matches.data])

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        product_id: form.product_id || null,
        category_id: form.category_id || null,
        image_url: form.image_url || null,
        available_quantity: Number(form.available_quantity),
        asking_price: String(form.asking_price),
        minimum_price: String(form.minimum_price),
        harvest_date: form.harvest_date,
        pickup_deadline: new Date(form.pickup_deadline).toISOString(),
        description: form.description || null,
      }
      return editing
        ? (await api.patch(`/rescue/listings/${editing.id}`, payload)).data
        : (await api.post('/rescue/listings', payload)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rescue-mine'] })
      queryClient.invalidateQueries({ queryKey: ['rescue-listings'] })
      toast.success(editing ? 'Rescue listing updated' : 'Rescue listing published')
      setOpenForm(false)
      setEditing(null)
      setForm({ ...BLANK })
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) => api.post(`/rescue/listings/${id}/status`, { status: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rescue-mine'] })
      queryClient.invalidateQueries({ queryKey: ['rescue-listings'] })
      toast.success('Listing status updated')
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const decide = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => api.post(`/rescue/offers/${id}/${accept ? 'accept' : 'reject'}`),
    onSuccess: (data: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ['rescue-mine'] })
      queryClient.invalidateQueries({ queryKey: ['rescue-listing-offers', expanded] })
      queryClient.invalidateQueries({ queryKey: ['rescue-listing-matches', expanded] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      if (vars.accept && data?.order) toast.success(`Accepted. Order ${data.order.order_number} created.`)
      else toast.success('Offer rejected')
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const apiOrigin = new URL(api.defaults.baseURL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1', window.location.origin).origin
      setForm((f) => ({ ...f, image_url: `${apiOrigin}${data.image_url}` }))
      toast.success('Image uploaded')
    } catch (e: any) {
      toast.error(apiError(e))
    } finally {
      setUploading(false)
    }
  }

  const startCreate = () => {
    setEditing(null)
    setForm({ ...BLANK })
    setOpenForm(true)
  }

  const startEdit = (listing: any) => {
    setEditing(listing)
    setForm({
      name: listing.name || '',
      description: listing.description || '',
      product_id: listing.product_id || '',
      category_id: listing.category_id || '',
      unit: listing.unit || 'kg',
      available_quantity: listing.available_quantity,
      asking_price: listing.asking_price,
      minimum_price: listing.minimum_price,
      harvest_date: listing.harvest_date || todayIso(),
      pickup_deadline: toLocalInput(new Date(listing.pickup_deadline)),
      pickup_location: listing.pickup_location || '',
      condition: listing.condition || '',
      reason: listing.reason || '',
      image_url: listing.image_url || '',
    })
    setOpenForm(true)
  }

  const fillFromProduct = (productId: string) => {
    const product = (Array.isArray(products.data) ? products.data : []).find((p: any) => String(p.id) === productId)
    setForm((f) => {
      const next: Record<string, any> = { ...f, product_id: productId }
      if (!product) return next
      return {
        ...next,
        name: next.name || product.name,
        category_id: product.category_id || next.category_id,
        unit: product.unit || next.unit,
        available_quantity: next.available_quantity || product.available_quantity,
        asking_price: next.asking_price || product.price,
        pickup_location: next.pickup_location || product.location || '',
        image_url: next.image_url || product.image_url || '',
        description: next.description || product.description || '',
      }
    })
  }

  const submit = () => {
    if (!form.name || form.name.trim().length < 2) return toast.error('Enter the produce name.')
    if (!form.available_quantity || Number(form.available_quantity) <= 0) return toast.error('Enter the quantity to rescue.')
    if (!form.asking_price || !form.minimum_price) return toast.error('Enter both prices.')
    if (Number(form.minimum_price) > Number(form.asking_price)) return toast.error('Minimum acceptable price cannot exceed the asking price.')
    if (!form.pickup_deadline || new Date(form.pickup_deadline) <= new Date()) return toast.error('Pickup deadline must be in the future.')
    if (!form.pickup_location || !form.condition || !form.reason) return toast.error('Add pickup location, condition and rescue reason.')
    if (!confirm(editing ? 'Save changes to this rescue listing?' : 'Publish this rescue listing for buyers?')) return
    save.mutate()
  }

  const activeCount = (mine.data || []).filter((l: any) => l.status === 'active').length
  const pendingCount = (mine.data || []).reduce((sum: number, l: any) => sum + Number(l.pending_offer_count || 0), 0)
  const emergency = (mine.data || []).filter((l: any) => l.status === 'active' && l.urgent).length

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <section className="rounded-3xl bg-gradient-to-br from-forest to-pine text-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <span className="badge bg-lime/20 text-lime border border-lime/30"><Leaf size={13} /> Harvest Rescue Exchange</span>
            <h1 className="font-display font-black text-3xl mt-3">Turn a surplus problem into a fair offer.</h1>
            <p className="text-white/75 text-sm mt-2">
              Publish time-sensitive produce with a public asking price and a private minimum acceptable price.
              Buyers can offer, and you decide. Accepting creates a pickup order and reserves stock atomically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-gold !py-2.5 text-sm" onClick={startCreate}><Plus size={16} /> New rescue listing</button>
            <Link to="/transport" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-white/25 hover:bg-white/10">Shared transport</Link>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-5 max-w-lg">
          {[['Active', activeCount], ['Pending offers', pendingCount], ['Urgent <24h', emergency]].map(([label, value]) => (
            <div key={label as string} className="bg-white/10 border border-white/10 rounded-2xl px-3 py-2.5 text-center">
              <div className="font-extrabold text-xl">{value}</div>
              <div className="text-[11px] text-white/65">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="my-listings">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 id="my-listings" className="font-display font-black text-2xl text-forest">My rescue listings</h2>
            <p className="text-xs text-muted mt-1">Minimum price is only shown to you. Buyers never see it.</p>
          </div>
          <button className="btn-primary !py-2.5 text-sm" onClick={startCreate}><Plus size={15} /> Add listing</button>
        </div>

        {mine.isLoading && <p className="text-sm text-muted mt-3">Loading your listings…</p>}
        {mine.isError && <div className="mt-3"><ErrorBox message={apiError(mine.error)} onRetry={() => mine.refetch()} /></div>}
        {mine.data?.length === 0 && (
          <div className="mt-3"><Empty title="No rescue listings yet" hint="List surplus or harvested produce before its pickup deadline." action={<button className="btn-primary" onClick={startCreate}>Create the first listing</button>} /></div>
        )}

        <div className="space-y-4 mt-4">
          {(mine.data || []).map((l: any) => (
            <article key={l.id} className="card overflow-hidden">
              <div className="p-4 sm:p-5 flex flex-wrap gap-4">
                <div className="img-frame w-24 h-24 rounded-xl shrink-0">
                  {l.image_url ? <img src={l.image_url} alt={l.name} onError={imgFallback} /> : <div className="w-full h-full grid place-items-center"><Sprout size={30} className="text-leaf" /></div>}
                </div>
                <div className="flex-1 min-w-56">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-xl">{l.name}</h3>
                    <StatusBadge status={l.status} />
                    {l.urgent && <span className="badge bg-red-100 text-red-700"><Timer size={12} /> urgent</span>}
                  </div>
                  <div className="text-sm mt-1">
                    Public ₹{Number(l.asking_price).toFixed(2)}/{l.unit}
                    <span className="text-muted"> · private minimum ₹{Number(l.minimum_price).toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {l.available_quantity} {l.unit} available · {l.reserved_quantity || 0} reserved · {l.pending_offer_count || 0} pending offer{l.pending_offer_count === 1 ? '' : 's'}
                  </div>
                  <div className="text-xs text-muted mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1"><MapPin size={12} /> {l.pickup_location}</span>
                    <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> Pickup by {fmt(l.pickup_deadline)}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={12} /> {l.hours_left} hours left</span>
                  </div>
                  <p className="text-xs mt-1"><b>Reason:</b> {l.reason} · <b>Condition:</b> {l.condition}</p>
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <div className="flex gap-2 flex-wrap">
                    <button className="btn-secondary !px-3 !py-2 text-sm" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                      Offers {l.pending_offer_count ? `(${l.pending_offer_count})` : ''}
                    </button>
                    {(l.status === 'active' || l.status === 'paused') && (
                      <button className="btn-secondary !px-3 !py-2 text-sm" onClick={() => startEdit(l)}><Pencil size={14} /> Edit</button>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {l.status === 'active' && (
                      <button className="btn-secondary !px-3 !py-2 text-sm" onClick={() => status.mutate({ id: l.id, next: 'paused' })}><Pause size={14} /> Pause</button>
                    )}
                    {l.status === 'paused' && (
                      <button className="btn-secondary !px-3 !py-2 text-sm" onClick={() => status.mutate({ id: l.id, next: 'active' })}><Play size={14} /> Resume</button>
                    )}
                    {(l.status === 'active' || l.status === 'paused') && (
                      <button className="btn-secondary !px-3 !py-2 text-sm text-red-600"
                        onClick={() => { if (confirm(`Cancel ${l.name}? Pending offers will be closed.`)) status.mutate({ id: l.id, next: 'cancelled' }) }}>
                        <Trash2 size={14} /> Cancel
                      </button>
                    )}
                    <SpeakButton text={`${l.name}. Public asking price ${l.asking_price} rupees per ${l.unit}. Your private minimum ${l.minimum_price} rupees. ${l.available_quantity} ${l.unit} available. ${l.pending_offer_count || 0} pending offers. Pickup by ${fmt(l.pickup_deadline)}.`} label="Listen" compact />
                  </div>
                </div>
              </div>

              {expanded === l.id && (
                <div className="border-t border-line bg-cream/40 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="font-bold">Offers for {l.name}</h4>
                    <button className="text-sm text-muted" onClick={() => setExpanded(null)}>Close</button>
                  </div>
                  {offers.isLoading && <p className="text-sm text-muted mt-2">Loading offers…</p>}
                  {offers.isError && <div className="mt-2"><ErrorBox message={apiError(offers.error)} onRetry={() => offers.refetch()} /></div>}
                  {offers.data?.items?.length === 0 && <p className="text-sm text-muted mt-2">No offers yet. Buyers will appear here when they make an offer.</p>}
                  <div className="grid md:grid-cols-2 gap-3 mt-3">
                    {(offers.data?.items || []).map((o: any) => {
                      const match = scoreByOffer[o.id]
                      return (
                        <div key={o.id} className="card p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <b>{o.buyer_name}</b>
                            <StatusBadge status={o.status} />
                            <span className="ml-auto font-extrabold">₹{Number(o.total).toFixed(2)}</span>
                          </div>
                          <div className="text-sm mt-1">₹{Number(o.price).toFixed(2)}/{o.listing_unit} × {o.quantity} {o.listing_unit}</div>
                          <div className="text-xs text-muted mt-1">Pickup proposed {fmt(o.proposed_pickup_at)} · expires {fmt(o.expires_at)}</div>
                          {o.note && <p className="text-xs mt-1">“{o.note}”</p>}
                          {match && (
                            <div className="mt-2">
                              <span className="badge bg-farm-light text-farm">{match.score}% fit</span>
                              {(match.match_reasons || []).map((r: string) => <div key={r} className="text-xs text-green-800 mt-1 flex gap-1"><CheckCircle2 size={12} className="shrink-0 mt-0.5" />{r}</div>)}
                              {(match.warnings || []).map((w: string) => <div key={w} className="text-xs text-amber-800 mt-1 flex gap-1"><AlertTriangle size={12} className="shrink-0 mt-0.5" />{w}</div>)}
                            </div>
                          )}
                          {o.status === 'pending' && !o.expired && (
                            <div className="flex gap-2 mt-3">
                              <button className="btn-primary !px-3.5 !py-2 text-sm flex-1"
                                disabled={decide.isPending}
                                onClick={() => { if (confirm(`Accept ${o.buyer_name}'s offer of ₹${o.price}/${o.listing_unit}? This creates a pickup order and reserves stock.`)) decide.mutate({ id: o.id, accept: true }) }}>
                                <Check size={14} /> Accept
                              </button>
                              <button className="btn-secondary !px-3.5 !py-2 text-sm flex-1"
                                disabled={decide.isPending}
                                onClick={() => { if (confirm(`Reject ${o.buyer_name}'s offer?`)) decide.mutate({ id: o.id, accept: false }) }}>
                                <X size={14} /> Reject
                              </button>
                            </div>
                          )}
                          {o.order_id && <Link to={`/orders/${o.order_id}`} className="btn-secondary !px-3 !py-2 text-sm mt-3">View created order</Link>}
                        </div>
                      )
                    })}
                  </div>
                  {matches.data?.method && <p className="text-[11px] text-muted mt-2">{matches.data.method}</p>}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {openForm && (
        <div className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="rescue-form-title">
          <div className="absolute inset-0 bg-pine/55 backdrop-blur-sm" onClick={() => setOpenForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-lift w-full max-w-2xl max-h-[94vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-line px-5 py-4 flex items-center justify-between gap-3 z-10">
              <h2 id="rescue-form-title" className="font-display font-black text-xl">{editing ? 'Edit rescue listing' : 'New rescue listing'}</h2>
              <button className="p-2 rounded-lg hover:bg-cream" aria-label="Close form" onClick={() => setOpenForm(false)}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label" htmlFor="rl-product">Link one of your products (optional)</label>
                <select id="rl-product" className="input" value={form.product_id} onChange={(e) => fillFromProduct(e.target.value)}>
                  <option value="">No linked product</option>
                  {(Array.isArray(products.data) ? products.data : []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.available_quantity} {p.unit} left</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted mt-1">Linking a product means accepted offers also reduce that product's stock. Quantity must not exceed its available stock.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="rl-name">Produce name</label>
                  <input id="rl-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tomatoes" />
                </div>
                <div>
                  <label className="label" htmlFor="rl-unit">Unit</label>
                  <select id="rl-unit" className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    {['kg', 'g', 'quintal', 'ton', 'dozen', 'piece', 'litre', 'bag'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="label" htmlFor="rl-qty">Quantity</label>
                  <input id="rl-qty" type="number" min="0.01" step="0.01" className="input" value={form.available_quantity} onChange={(e) => setForm({ ...form, available_quantity: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="rl-ask">Asking ₹ / unit</label>
                  <input id="rl-ask" type="number" min="0.01" step="0.01" className="input" value={form.asking_price} onChange={(e) => setForm({ ...form, asking_price: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="rl-min">Private minimum ₹</label>
                  <input id="rl-min" type="number" min="0.01" step="0.01" className="input" value={form.minimum_price} onChange={(e) => setForm({ ...form, minimum_price: e.target.value })} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="rl-harvest">Harvest date</label>
                  <input id="rl-harvest" type="date" className="input" value={form.harvest_date} onChange={(e) => setForm({ ...form, harvest_date: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="rl-deadline">Pickup deadline</label>
                  <input id="rl-deadline" type="datetime-local" className="input" value={form.pickup_deadline} onChange={(e) => setForm({ ...form, pickup_deadline: e.target.value })} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="rl-location">Pickup location</label>
                  <input id="rl-location" className="input" value={form.pickup_location} onChange={(e) => setForm({ ...form, pickup_location: e.target.value })} placeholder="Village / town, district" />
                </div>
                <div>
                  <label className="label" htmlFor="rl-condition">Condition</label>
                  <input id="rl-condition" className="input" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="e.g. Ripe, cosmetically imperfect" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="rl-reason">Rescue reason</label>
                <input id="rl-reason" className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Surplus harvest, pick-up before market closes" />
              </div>
              <div>
                <label className="label" htmlFor="rl-desc">Description (optional)</label>
                <textarea id="rl-desc" rows={2} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="rl-image">Image URL</label>
                <input id="rl-image" className="input" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
                <label className="btn-secondary mt-2 cursor-pointer !px-3.5 !py-2 text-sm inline-flex">
                  <ImagePlus size={15} /> {uploading ? 'Uploading…' : 'Upload image'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }} />
                </label>
                <p className="text-[11px] text-muted mt-1">JPG/PNG/WebP under 5 MB, using the existing upload service.</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                The private minimum is stored for your offer ranking only. Buyers see the asking price and your public listing details, never the minimum.
              </div>
              <div className="flex gap-2 pt-1">
                <button className="btn-primary flex-1" disabled={save.isPending || uploading} onClick={submit}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Publish rescue listing'}</button>
                <button className="btn-secondary" onClick={() => setOpenForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
