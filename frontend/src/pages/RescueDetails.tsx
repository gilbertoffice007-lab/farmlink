import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, MapPin, Sprout, Timer } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
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

export default function RescueDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const [offer, setOffer] = useState({ price: '', quantity: '', pickup: '', expires: '', note: '' })
  const listing = useQuery({ queryKey: ['rescue-listing', id], queryFn: async () => (await api.get(`/rescue/listings/${id}`)).data })
  const matches = useQuery({
    queryKey: ['rescue-listing-buyer-matches', id],
    queryFn: async () => (await api.get('/rescue/matches', { params: { limit: 30 } })).data,
    enabled: !!listing.data && user?.role === 'buyer',
  })
  const ownOffer = useQuery({
    queryKey: ['rescue-offers'],
    queryFn: async () => (await api.get('/rescue/offers/mine')).data,
    enabled: user?.role === 'buyer',
  })

  const createOffer = useMutation({
    mutationFn: async () => {
      if (!listing.data) throw new Error('Listing is not loaded.')
      return (await api.post(`/rescue/listings/${listing.data.id}/offers`, {
        price: offer.price,
        quantity: offer.quantity,
        proposed_pickup_at: new Date(offer.pickup).toISOString(),
        expires_at: offer.expires ? new Date(offer.expires).toISOString() : undefined,
        note: offer.note || undefined,
      })).data
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['rescue-offers'] })
      queryClient.invalidateQueries({ queryKey: ['rescue-listings'] })
      queryClient.invalidateQueries({ queryKey: ['rescue-listing', id] })
      toast.success(`Offer sent. Expires ${fmt(data.expires_at)}.`)
      setOffer({ price: '', quantity: '', pickup: '', expires: '', note: '' })
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  if (listing.isLoading) return <div className="max-w-3xl mx-auto p-5"><div className="shimmer h-80" /></div>
  if (listing.isError || !listing.data) return <div className="max-w-3xl mx-auto p-5"><ErrorBox message={apiError(listing.error)} onRetry={() => listing.refetch()} /></div>

  const l = listing.data
  const pending = (ownOffer.data || []).find((o: any) => o.listing_id === l.id && o.status === 'pending')
  const relatedMatch = (matches.data?.matches || []).find((m: any) => m.listing.id === l.id)
  const deadline = new Date(l.pickup_deadline)
  const defaultPickup = new Date(Math.min(Date.now() + 24 * 3600 * 1000, deadline.getTime() - 3600 * 1000))
  const summary = `${l.name}. Asking ${l.asking_price} rupees per ${l.unit}. ${l.available_quantity} ${l.unit} available. Pickup from ${l.pickup_location} by ${fmt(l.pickup_deadline)}. Condition: ${l.condition}. Rescue reason: ${l.reason}.`

  const submit = () => {
    if (!offer.price || !offer.quantity || !offer.pickup) { toast.error('Enter price, quantity and proposed pickup time.'); return }
    if (new Date(offer.pickup) > deadline) { toast.error('Proposed pickup must be on or before the deadline.'); return }
    if (!confirm(`Send an offer of ₹${offer.price} for ${offer.quantity} ${l.unit} of ${l.name}? No order is created until the farmer accepts.`)) return
    createOffer.mutate()
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <Link to="/rescue" className="text-sm font-semibold text-farm inline-flex items-center gap-1.5"><ArrowLeft size={15} /> Back to rescue listings</Link>
      <div className="grid lg:grid-cols-[1.1fr_.9fr] gap-6 mt-3">
        <div>
          <div className="card overflow-hidden">
            <div className="img-frame h-56 sm:h-72">
              {l.image_url ? <img src={l.image_url} alt={l.name} onError={imgFallback} /> : <div className="w-full h-full grid place-items-center"><Sprout size={56} className="text-leaf" /></div>}
              <div className="absolute top-3 left-3 flex gap-2">
                <StatusBadge status={l.status} />
                {l.urgent && <span className="badge bg-red-600 text-white"><Timer size={12} /> urgent deadline</span>}
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="font-display font-black text-3xl text-forest">{l.name}</h1>
                  <p className="text-sm text-muted">{l.farm_name || l.seller_name} · {l.category_name || 'Produce'}</p>
                </div>
                <div className="text-right">
                  <div className="font-display font-black text-2xl text-farm">₹{Number(l.asking_price).toFixed(2)}</div>
                  <div className="text-xs text-muted">per {l.unit}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <SpeakButton text={summary} label="Read listing" />
                {l.is_owner && <Link to="/rescue/manage" className="btn-secondary !px-3.5 !py-2 text-sm">Manage listing</Link>}
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
                <div className="rounded-xl bg-cream/60 p-3"><div className="text-xs text-muted font-semibold">Available</div><div className="font-bold">{l.available_quantity} {l.unit}</div></div>
                <div className="rounded-xl bg-cream/60 p-3"><div className="text-xs text-muted font-semibold">Pickup deadline</div><div className="font-bold">{fmt(l.pickup_deadline)}</div></div>
                <div className="rounded-xl bg-cream/60 p-3"><div className="text-xs text-muted font-semibold">Pickup location</div><div className="font-bold flex items-center gap-1"><MapPin size={13} /> {l.pickup_location}</div></div>
                <div className="rounded-xl bg-cream/60 p-3"><div className="text-xs text-muted font-semibold">Condition</div><div className="font-bold">{l.condition}</div></div>
              </div>
              <p className="text-sm mt-4"><b>Why it needs rescuing:</b> {l.reason}</p>
              {l.description && <p className="text-sm text-charcoal/90 mt-2 leading-relaxed">{l.description}</p>}
              <p className="text-xs text-muted mt-4 flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> Urgency is based on the farmer's pickup deadline. FarmLink does not claim or guarantee produce quality or spoilage status.</p>
              {l.is_owner && <p className="text-xs mt-2 text-muted flex items-center gap-1.5"><CheckCircle2 size={13} /> Your private minimum ₹{Number(l.minimum_price).toFixed(2)} is visible only to you.</p>}
            </div>
          </div>
        </div>

        <aside>
          <div className="card p-5">
            <h2 className="font-display font-bold text-xl">Make an offer</h2>
            <p className="text-xs text-muted mt-1">Your price is a proposal. The farmer must accept before an order is created.</p>
            {user?.role !== 'buyer' ? (
              <div className="mt-3 text-sm rounded-xl bg-cream/60 p-3">
                Only buyer accounts can make offers. {l.is_owner ? 'This is your listing — use Manage listing to review offers.' : 'You can still browse this rescue listing.'}
              </div>
            ) : pending ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                <b>You already have a pending offer.</b>
                <div className="text-xs mt-1">₹{Number(pending.price).toFixed(2)}/{pending.listing_unit} × {pending.quantity} · expires {fmt(pending.expires_at)}. Withdraw it from your rescue offers list before making another.</div>
                <Link to="/rescue" className="text-farm font-semibold text-sm mt-2 inline-block">Go to my offers</Link>
              </div>
            ) : !l.can_offer ? (
              <div className="mt-3"><Empty title="This listing is not accepting offers" hint={l.status === 'active' ? 'The remaining quantity may already be reserved.' : `Status: ${l.status}.`} /></div>
            ) : (
              <div className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label" htmlFor="rd-price">Price ₹ / {l.unit}</label>
                    <input id="rd-price" type="number" min="0.01" step="0.01" className="input" value={offer.price} onChange={(e) => setOffer({ ...offer, price: e.target.value })} placeholder={String(l.asking_price)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="rd-qty">Quantity ({l.unit})</label>
                    <input id="rd-qty" type="number" min="0.01" step="0.01" max={l.available_quantity} className="input" value={offer.quantity} onChange={(e) => setOffer({ ...offer, quantity: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="rd-pickup">Proposed pickup</label>
                  <input id="rd-pickup" type="datetime-local" className="input" value={offer.pickup} max={toLocalInput(deadline)} onChange={(e) => setOffer({ ...offer, pickup: e.target.value })} />
                  <button type="button" className="text-xs text-farm font-semibold mt-1" onClick={() => setOffer({ ...offer, pickup: toLocalInput(defaultPickup) })}>Use next-day pickup</button>
                </div>
                <div>
                  <label className="label" htmlFor="rd-expiry">Offer expiry (optional)</label>
                  <input id="rd-expiry" type="datetime-local" className="input" value={offer.expires} max={toLocalInput(deadline)} onChange={(e) => setOffer({ ...offer, expires: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="rd-note">Note (optional)</label>
                  <textarea id="rd-note" rows={2} className="input" value={offer.note} onChange={(e) => setOffer({ ...offer, note: e.target.value })} />
                </div>
                <p className="text-xs text-muted">Offer total: <b>₹{(Number(offer.price || 0) * Number(offer.quantity || 0)).toFixed(2)}</b></p>
                <button className="btn-primary w-full" disabled={createOffer.isPending} onClick={submit}>{createOffer.isPending ? 'Sending…' : 'Send offer'}</button>
              </div>
            )}
          </div>

          {relatedMatch && user?.role === 'buyer' && (
            <div className="card p-5 mt-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold">Why this may fit you</h2>
                <span className="badge bg-farm-light text-farm">{relatedMatch.score}% match</span>
              </div>
              {(relatedMatch.match_reasons || []).map((r: string) => <div key={r} className="text-xs text-green-800 mt-1.5 flex gap-1.5"><CheckCircle2 size={12} className="mt-0.5 shrink-0" />{r}</div>)}
              {(relatedMatch.warnings || []).map((w: string) => <div key={w} className="text-xs text-amber-800 mt-1.5 flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{w}</div>)}
              <p className="text-[11px] text-muted mt-3">{matches.data?.method}</p>
            </div>
          )}

          <div className="card p-5 mt-4 text-sm">
            <div className="font-bold flex items-center gap-2"><CalendarClock size={16} className="text-farm" /> How rescue works</div>
            <ol className="text-xs text-muted mt-2 space-y-1.5 list-decimal list-inside">
              <li>Make an offer with a price and pickup time.</li>
              <li>The farmer accepts, rejects or lets it expire.</li>
              <li>If accepted, stock is reserved atomically and a pickup order is created.</li>
              <li>Track the order with the normal FarmLink order flow.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  )
}
