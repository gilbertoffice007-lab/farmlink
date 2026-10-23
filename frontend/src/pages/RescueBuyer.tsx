import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Leaf, MapPin, Search, Sparkles, Sprout, Timer, X,
} from 'lucide-react'
import { api, apiError } from '../lib/api'
import { queryClient } from '../lib/query-client'
import { Empty, ErrorBox, Skeletons, StatusBadge } from '../components/common/ui'
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

function defaultPickup(deadline?: string) {
  const desired = Date.now() + 24 * 3600 * 1000
  const max = deadline ? new Date(deadline).getTime() : desired
  return toLocalInput(new Date(Math.min(desired, max - 60 * 60 * 1000)))
}

function listingSpeech(l: any) {
  return [
    `${l.name}. Asking ${Number(l.asking_price).toFixed(0)} rupees per ${l.unit}.`,
    `${Number(l.available_quantity).toFixed(0)} ${l.unit} available.`,
    `Pickup from ${l.pickup_location} by ${fmt(l.pickup_deadline)}.`,
    `Condition: ${l.condition}. Reason for rescue: ${l.reason}.`,
    l.farm_name ? `Listed by ${l.farm_name}.` : '',
  ].filter(Boolean).join(' ')
}

export default function RescueBuyer() {
  const [q, setQ] = useState('')
  const [location, setLocation] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minQuantity, setMinQuantity] = useState('')
  const [deadlineBefore, setDeadlineBefore] = useState('')
  const [sort, setSort] = useState('deadline')
  const [page, setPage] = useState(1)
  const [offerFor, setOfferFor] = useState<any | null>(null)
  const [offer, setOffer] = useState({ price: '', quantity: '', pickup: '', expires: '', note: '' })

  const [matchQty, setMatchQty] = useState('')
  const [matchBudget, setMatchBudget] = useState('')
  const [matchLocation, setMatchLocation] = useState('')
  const [showMatches, setShowMatches] = useState(false)

  const listings = useQuery({
    queryKey: ['rescue-listings', q, location, maxPrice, minQuantity, deadlineBefore, sort, page],
    queryFn: async () => (await api.get('/rescue/listings', {
      params: {
        q: q || undefined,
        location: location || undefined,
        max_price: maxPrice || undefined,
        min_quantity: minQuantity || undefined,
        deadline_before: deadlineBefore ? new Date(deadlineBefore).toISOString() : undefined,
        sort, page, page_size: 12,
      },
    })).data,
  })

  const offers = useQuery({
    queryKey: ['rescue-offers'],
    queryFn: async () => (await api.get('/rescue/offers/mine')).data,
  })

  const matches = useQuery({
    queryKey: ['rescue-matches', matchQty, matchBudget, matchLocation],
    enabled: showMatches,
    queryFn: async () => (await api.get('/rescue/matches', {
      params: {
        quantity: matchQty || undefined,
        budget: matchBudget || undefined,
        pickup_location: matchLocation || undefined,
        limit: 6,
      },
    })).data,
  })

  const makeOffer = useMutation({
    mutationFn: async () => {
      if (!offerFor) throw new Error('Choose a listing first.')
      return (await api.post(`/rescue/listings/${offerFor.id}/offers`, {
        price: offer.price,
        quantity: offer.quantity,
        proposed_pickup_at: new Date(offer.pickup).toISOString(),
        expires_at: offer.expires ? new Date(offer.expires).toISOString() : undefined,
        note: offer.note || undefined,
      })).data
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['rescue-listings'] })
      queryClient.invalidateQueries({ queryKey: ['rescue-offers'] })
      toast.success(`Offer sent. Valid until ${fmt(data.expires_at)}.`)
      setOfferFor(null)
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const withdraw = useMutation({
    mutationFn: (id: string) => api.post(`/rescue/offers/${id}/withdraw`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rescue-offers'] })
      queryClient.invalidateQueries({ queryKey: ['rescue-listings'] })
      toast.success('Offer withdrawn')
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const openOffer = (listing: any) => {
    setOfferFor(listing)
    setOffer({
      price: String(listing.asking_price),
      quantity: String(Math.min(Number(listing.available_quantity), 1)),
      pickup: defaultPickup(listing.pickup_deadline),
      expires: '',
      note: '',
    })
  }

  const submitOffer = () => {
    if (!offerFor) return
    if (!offer.price || Number(offer.price) <= 0) { toast.error('Enter a valid offer price.'); return }
    if (!offer.quantity || Number(offer.quantity) <= 0) { toast.error('Enter a valid quantity.'); return }
    if (!offer.pickup) { toast.error('Choose a proposed pickup time.'); return }
    if (new Date(offer.pickup) > new Date(offerFor.pickup_deadline)) {
      toast.error('Proposed pickup must be on or before the rescue deadline.')
      return
    }
    if (!confirm(`Send an offer of ₹${offer.price} for ${offer.quantity} ${offerFor.unit} of ${offerFor.name}? The farmer must accept before an order is created.`)) return
    makeOffer.mutate()
  }

  const activeOffers = useMemo(
    () => (Array.isArray(offers.data) ? offers.data : []).filter((o: any) => ['pending', 'accepted'].includes(o.status)),
    [offers.data],
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <section className="rounded-3xl overflow-hidden bg-gradient-to-br from-forest to-pine text-white p-6 sm:p-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(520px_240px_at_92%_0%,rgba(185,217,122,.24),transparent)]" aria-hidden="true" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="badge bg-lime/20 text-lime border border-lime/30"><Leaf size={13} /> Harvest Rescue Exchange</span>
            <h1 className="font-display font-black text-3xl sm:text-4xl mt-3">Rescue fresh produce before it goes to waste.</h1>
            <p className="text-white/75 text-sm sm:text-base mt-2 leading-relaxed">
              Buy surplus harvests directly from farmers. Prices and pickup deadlines are set by the farmer;
              urgency reflects the deadline, not a spoilage guarantee. Your offer is only confirmed after the farmer accepts it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/market" className="btn-gold !py-2.5 text-sm">Browse marketplace <ArrowRight size={15} /></Link>
            <Link to="/voice" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-white/25 hover:bg-white/10">
              Voice assistant
            </Link>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6 mt-6">
        <aside className="card p-5 h-fit lg:sticky lg:top-24">
          <h2 className="font-display font-bold text-lg flex items-center gap-2"><Search size={17} className="text-farm" /> Find rescue produce</h2>
          <div className="space-y-3 mt-3">
            <div>
              <label className="label" htmlFor="rescue-q">Produce</label>
              <input id="rescue-q" className="input" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Tomatoes, rice…" />
            </div>
            <div>
              <label className="label" htmlFor="rescue-location">Pickup area</label>
              <input id="rescue-location" className="input" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1) }} placeholder="Erode" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="rescue-max">Max ₹ / unit</label>
                <input id="rescue-max" type="number" min="0" className="input" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1) }} />
              </div>
              <div>
                <label className="label" htmlFor="rescue-minqty">Min quantity</label>
                <input id="rescue-minqty" type="number" min="0" className="input" value={minQuantity} onChange={(e) => { setMinQuantity(e.target.value); setPage(1) }} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="rescue-deadline">Pickup deadline before</label>
              <input id="rescue-deadline" type="datetime-local" className="input" value={deadlineBefore} onChange={(e) => { setDeadlineBefore(e.target.value); setPage(1) }} />
            </div>
            <div>
              <label className="label" htmlFor="rescue-sort">Sort by</label>
              <select id="rescue-sort" className="input" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }}>
                <option value="deadline">Deadline (soonest)</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="newest">Newest first</option>
              </select>
            </div>
            <button type="button" className="btn-secondary w-full" onClick={() => {
              setQ(''); setLocation(''); setMaxPrice(''); setMinQuantity(''); setDeadlineBefore(''); setSort('deadline'); setPage(1)
            }}>Clear filters</button>
          </div>
          <p className="text-xs text-muted mt-3">
            Asking price is public. The farmer's minimum acceptable price is private and never shown to buyers.
          </p>
        </aside>

        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-display font-black text-2xl text-forest">
              Rescue listings {listings.data ? <span className="text-sm font-sans font-medium text-muted">· {listings.data.total}</span> : null}
            </h2>
            {listings.data?.items?.length ? (
              <SpeakButton
                text={`${listings.data.total} rescue listings found. ${listings.data.items.slice(0, 3).map((l: any) => `${l.name}, ${l.available_quantity} ${l.unit}, asking ${l.asking_price} rupees per ${l.unit}, pickup by ${fmt(l.pickup_deadline)}`).join('. ')}`}
                label="Read results"
              />
            ) : null}
          </div>
          <p className="text-xs text-muted mt-1">Ordered by pickup deadline by default. Urgency is a deadline signal, not a quality guarantee.</p>

          <div className="card p-4 mt-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="font-bold flex items-center gap-1.5"><Sparkles size={16} className="text-farm" /> Suggested rescue matches</div>
                <p className="text-xs text-muted mt-0.5">Explainable, rule-based suggestions from your quantity, budget and pickup area.</p>
              </div>
              <button className="btn-secondary !px-3.5 !py-2 text-sm" onClick={() => setShowMatches((v) => !v)}>
                {showMatches ? 'Hide suggestions' : 'Find matches'}
              </button>
            </div>
            {showMatches && (
              <div className="mt-3">
                <div className="grid sm:grid-cols-3 gap-2">
                  <input aria-label="Required quantity" type="number" min="0" className="input" placeholder="Quantity needed" value={matchQty} onChange={(e) => setMatchQty(e.target.value)} />
                  <input aria-label="Budget per unit" type="number" min="0" className="input" placeholder="Budget ₹ / unit" value={matchBudget} onChange={(e) => setMatchBudget(e.target.value)} />
                  <input aria-label="Pickup area" className="input" placeholder="Pickup area" value={matchLocation} onChange={(e) => setMatchLocation(e.target.value)} />
                </div>
                {matches.isFetching && <p className="text-sm text-muted mt-2">Finding matches…</p>}
                {matches.isError && <div className="mt-2"><ErrorBox message={apiError(matches.error)} onRetry={() => matches.refetch()} /></div>}
                {matches.data?.matches?.length === 0 && <p className="text-sm text-muted mt-2">No listings match all your criteria yet.</p>}
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  {(matches.data?.matches || []).map((m: any) => (
                    <div key={m.listing.id} className="rounded-2xl border border-line p-3.5 bg-cream/50">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold">{m.listing.name}</div>
                          <div className="text-xs text-muted">{m.listing.available_quantity} {m.listing.unit} · ₹{m.listing.asking_price}/{m.listing.unit}</div>
                        </div>
                        <span className="badge bg-farm-light text-farm">{m.score}% match</span>
                      </div>
                      {m.match_reasons.map((r: string) => <div key={r} className="text-xs text-green-800 mt-1 flex gap-1.5"><CheckCircle2 size={12} className="shrink-0 mt-0.5" />{r}</div>)}
                      {m.warnings.map((w: string) => <div key={w} className="text-xs text-amber-800 mt-1 flex gap-1.5"><AlertTriangle size={12} className="shrink-0 mt-0.5" />{w}</div>)}
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        <Link to={`/rescue/${m.listing.id}`} className="text-sm font-semibold text-farm">Details</Link>
                        {m.listing.can_offer && <button className="text-sm font-semibold text-farm" onClick={() => openOffer(m.listing)}>Make offer</button>}
                      </div>
                    </div>
                  ))}
                </div>
                {matches.data?.method && <p className="text-[11px] text-muted mt-2">{matches.data.method}</p>}
              </div>
            )}
          </div>

          {listings.isLoading && <div className="mt-4"><Skeletons n={6} /></div>}
          {listings.isError && <div className="mt-4"><ErrorBox message={apiError(listings.error)} onRetry={() => listings.refetch()} /></div>}
          {listings.data?.items?.length === 0 && (
            <div className="mt-4"><Empty title="No rescue listings match these filters" hint="Try clearing the deadline or price filter. New listings appear as farmers publish them." /></div>
          )}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            {(listings.data?.items || []).map((l: any) => (
              <article key={l.id} className="card overflow-hidden flex flex-col">
                <div className="img-frame h-36">
                  {l.image_url ? <img src={l.image_url} alt={l.name} loading="lazy" onError={imgFallback} /> : <div className="w-full h-full grid place-items-center"><Sprout size={36} className="text-leaf" /></div>}
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    {l.urgent && <span className="badge bg-red-600 text-white"><Timer size={12} /> Urgent deadline</span>}
                    <span className="badge bg-white/95 text-forest">{l.condition}</span>
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-bold text-lg leading-tight">{l.name}</h3>
                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-farm">₹{Number(l.asking_price).toFixed(2)}</div>
                      <div className="text-[11px] text-muted">per {l.unit}</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted mt-1">{l.available_quantity} {l.unit} available · {l.farm_name || l.seller_name}</p>
                  <div className="text-xs mt-2 space-y-1">
                    <div className="flex items-center gap-1.5"><MapPin size={12} className="text-farm" /> {l.pickup_location}</div>
                    <div className="flex items-center gap-1.5"><CalendarClock size={12} className="text-farm" /> Pickup by {fmt(l.pickup_deadline)}</div>
                    <div className="flex items-center gap-1.5"><Timer size={12} className="text-farm" /> {l.hours_left != null ? `${l.hours_left} hours left` : 'Deadline set'}</div>
                  </div>
                  <p className="text-xs mt-2"><b>Rescue reason:</b> {l.reason}</p>
                  {l.description && <p className="text-xs text-muted mt-1 line-clamp-2">{l.description}</p>}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Link to={`/rescue/${l.id}`} className="btn-secondary !px-3 !py-2 text-sm">Details</Link>
                    {l.can_offer && <button className="btn-primary !px-3 !py-2 text-sm" onClick={() => openOffer(l)}>Make offer</button>}
                    <SpeakButton text={listingSpeech(l)} label="Listen" compact />
                  </div>
                  {!l.can_offer && <p className="text-xs text-muted mt-2">{l.status === 'active' ? 'Fully reserved for now.' : `Listing ${l.status}.`}</p>}
                </div>
              </article>
            ))}
          </div>
          {(listings.data?.pages || 1) > 1 && (
            <div className="flex gap-2 justify-center mt-6">
              {Array.from({ length: listings.data.pages }).map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  className={`min-w-10 h-10 px-3 rounded-xl border text-sm font-bold ${page === i + 1 ? 'bg-forest text-white border-forest' : 'bg-white border-line hover:border-farm'}`}>{i + 1}</button>
              ))}
            </div>
          )}

          <section className="mt-8" aria-labelledby="my-rescue-offers">
            <h2 id="my-rescue-offers" className="font-display font-black text-2xl text-forest">My rescue offers</h2>
            <p className="text-xs text-muted mt-1">Pending offers reserve nothing until the farmer accepts. Accepted offers become normal orders.</p>
            {offers.isLoading && <p className="text-sm text-muted mt-3">Loading offers…</p>}
            {offers.isError && <div className="mt-3"><ErrorBox message={apiError(offers.error)} onRetry={() => offers.refetch()} /></div>}
            {activeOffers.length === 0 && !offers.isLoading && <div className="mt-3"><Empty title="No active rescue offers" hint="Make an offer on a listing above. The farmer decides whether to accept." /></div>}
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              {activeOffers.map((o: any) => (
                <div key={o.id} className="card p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b>{o.listing_name}</b>
                    <StatusBadge status={o.status} />
                    <span className="ml-auto font-bold">₹{Number(o.total).toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    ₹{Number(o.price).toFixed(2)}/{o.listing_unit} × {o.quantity} {o.listing_unit} · pickup {fmt(o.proposed_pickup_at)} · expires {fmt(o.expires_at)}
                  </div>
                  {o.note && <p className="text-xs mt-1">Note: {o.note}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {o.can_withdraw && (
                      <button className="btn-secondary !px-3 !py-2 text-sm inline-flex items-center gap-1"
                        onClick={() => { if (confirm(`Withdraw your offer for ${o.listing_name}?`)) withdraw.mutate(o.id) }}>
                        <X size={14} /> Withdraw
                      </button>
                    )}
                    {o.order_id && <Link to={`/orders/${o.order_id}`} className="btn-primary !px-3 !py-2 text-sm">View order</Link>}
                    <SpeakButton text={`Offer for ${o.listing_name}: ${o.price} rupees per ${o.listing_unit} for ${o.quantity} ${o.listing_unit}. Status ${o.status}. Expires ${fmt(o.expires_at)}.`} compact />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {offerFor && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="offer-title">
          <div className="absolute inset-0 bg-pine/55 backdrop-blur-sm" onClick={() => setOfferFor(null)} />
          <div className="relative bg-white rounded-2xl shadow-lift w-full max-w-lg p-5 max-h-[92vh] overflow-auto">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h2 id="offer-title" className="font-display font-black text-xl">Make an offer</h2>
                <p className="text-sm text-muted">{offerFor.name} · asking ₹{Number(offerFor.asking_price).toFixed(2)}/{offerFor.unit}</p>
              </div>
              <button className="p-2 rounded-lg hover:bg-cream" aria-label="Close offer form" onClick={() => setOfferFor(null)}><X size={18} /></button>
            </div>
            <div className="text-xs text-muted mt-2">
              {offerFor.available_quantity} {offerFor.unit} available · pickup by {fmt(offerFor.pickup_deadline)}.
              Your offer is visible to this farmer only. The private minimum price is not disclosed to you.
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="label" htmlFor="offer-price">Your price (₹ / {offerFor.unit})</label>
                <input id="offer-price" type="number" min="0.01" step="0.01" className="input" value={offer.price} onChange={(e) => setOffer({ ...offer, price: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="offer-qty">Quantity ({offerFor.unit})</label>
                <input id="offer-qty" type="number" min="0.01" step="0.01" max={offerFor.available_quantity} className="input" value={offer.quantity} onChange={(e) => setOffer({ ...offer, quantity: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="offer-pickup">Proposed pickup</label>
                <input id="offer-pickup" type="datetime-local" className="input" value={offer.pickup} max={toLocalInput(new Date(offerFor.pickup_deadline))} onChange={(e) => setOffer({ ...offer, pickup: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="offer-expiry">Offer expiry (optional)</label>
                <input id="offer-expiry" type="datetime-local" className="input" value={offer.expires} max={toLocalInput(new Date(offerFor.pickup_deadline))} onChange={(e) => setOffer({ ...offer, expires: e.target.value })} />
              </div>
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="offer-note">Note to farmer (optional)</label>
              <textarea id="offer-note" rows={2} className="input" value={offer.note} onChange={(e) => setOffer({ ...offer, note: e.target.value })} placeholder="Pickup arrangement or quality question" />
            </div>
            <p className="text-xs text-muted mt-2">
              Estimated offer total: <b>₹{(Number(offer.price || 0) * Number(offer.quantity || 0)).toFixed(2)}</b>. No order is created until the farmer accepts.
            </p>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary flex-1" disabled={makeOffer.isPending} onClick={submitOffer}>{makeOffer.isPending ? 'Sending…' : 'Send offer'}</button>
              <button className="btn-secondary" onClick={() => setOfferFor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
