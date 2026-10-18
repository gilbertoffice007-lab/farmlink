import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Heart, Minus, Plus, Sprout, MapPin, Truck, CalendarClock, ShieldCheck, Store } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { Empty, ErrorBox, StatusBadge, Stars, VegMark } from '../components/common/ui'
import { Price } from '../components/marketplace/ProductCard'
import { imgFallback } from '../lib/images'

export default function ProductDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const canBuy = !user || user.role === 'buyer'
  const [qty, setQty] = useState(1)
  const { data: p, isLoading, isError, refetch } = useQuery({
    queryKey: ['product', id], queryFn: async () => (await api.get(`/products/${id}`)).data
  })
  const { data: reviews } = useQuery({
    queryKey: ['reviews', id], queryFn: async () => (await api.get(`/products/${id}/reviews`)).data, enabled: !!id
  })
  const { data: related } = useQuery({
    queryKey: ['related', p?.category_id], enabled: !!p?.category_id,
    queryFn: async () => (await api.get('/products', { params: { category_id: p.category_id, page_size: 4 } })).data
  })
  const cart = useMutation({
    mutationFn: () => api.post('/cart/items', { product_id: id, quantity: qty }),
    onSuccess: () => toast.success('Added to cart'), onError: (e: any) => toast.error(apiError(e))
  })
  const handleAdd = () => {
    if (!user) { toast('Please log in as a buyer to shop.'); nav('/login'); return }
    cart.mutate()
  }
  const handleWish = () => {
    if (!user) { toast('Please log in as a buyer to shop.'); nav('/login'); return }
    api.post(`/wishlist/${p.id}`).then(() => toast.success('Saved to wishlist')).catch((e) => toast.error(apiError(e)))
  }

  if (isLoading) return <div className="max-w-6xl mx-auto p-4"><div className="shimmer h-96" /></div>
  if (isError || !p) return <div className="max-w-3xl mx-auto p-4"><ErrorBox message="Product not found or unavailable." onRetry={() => refetch()} /></div>

  const out = Number(p.available_quantity) <= 0
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <nav className="text-sm text-muted mb-4" aria-label="Breadcrumb">
        <Link to="/market" className="hover:text-farm">Marketplace</Link> / {p.category_name || 'Produce'} / <b className="text-charcoal">{p.name}</b>
      </nav>
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="card overflow-hidden h-fit lg:sticky lg:top-24">
          <div className="img-frame h-[420px]">
            {p.image_url
              ? <img src={p.image_url} alt={p.name} onError={imgFallback} />
              : <div className="w-full h-full grid place-items-center"><Sprout size={72} className="text-leaf" /></div>}
            <span className="absolute top-3 left-3 badge bg-white/95 text-forest shadow">{p.category_name || 'Produce'}</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-line text-center text-xs">
            {[['Harvest', p.harvest_date || 'This week'], ['Ships from', p.location || 'Farm'], ['Unit', `per ${p.unit}`]].map(([l, v]) => (
              <div key={l} className="py-3 px-2"><div className="text-muted font-medium">{l}</div><div className="font-bold mt-0.5">{v}</div></div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <VegMark />
            <span className="inline-flex items-center gap-1"><MapPin size={13} />{p.location}</span>
            <span>·</span><Stars avg={p.rating_avg} count={p.rating_count} />
          </div>
          <h1 className="font-display font-black text-4xl text-forest mt-2">{p.name}</h1>
          <Link to={`/market`} className="text-sm text-muted hover:text-farm inline-flex items-center gap-1.5 mt-1.5">
            <Store size={14} /> Sold by <b>{p.farm_name || p.seller_name}</b>
          </Link>
          <div className="mt-3"><Price value={p.price} unit={p.unit} big /></div>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={out ? 'inactive' : 'active'} />
            <span className="text-sm text-muted">{out ? 'Out of stock' : `${p.available_quantity} ${p.unit} available · min order ${p.minimum_order_quantity} ${p.unit}`}</span>
          </div>
          <p className="text-[15px] mt-4 leading-relaxed text-charcoal/90">{p.description || 'Fresh farm produce listed directly by the farmer.'}</p>

          {!out && canBuy && (
            <div className="card p-4 mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center border border-line rounded-xl overflow-hidden" role="group" aria-label="Quantity">
                <button className="px-3.5 py-2.5 hover:bg-cream transition" aria-label="Decrease quantity" onClick={() => setQty(Math.max(Number(p.minimum_order_quantity) || 1, qty - 1))}><Minus size={16} /></button>
                <span className="px-4 font-bold min-w-12 text-center" aria-live="polite">{qty} {p.unit}</span>
                <button className="px-3.5 py-2.5 hover:bg-cream transition" aria-label="Increase quantity" onClick={() => setQty(Math.min(Number(p.available_quantity), qty + 1))}><Plus size={16} /></button>
              </div>
              <button className="btn-primary flex-1 min-w-40" disabled={cart.isPending} onClick={handleAdd}>
                Add to cart · ₹{(Number(p.price) * qty).toFixed(0)}
              </button>
              <button className="btn-secondary !px-3" aria-label="Save to wishlist" onClick={handleWish}><Heart size={17} /></button>
            </div>
          )}
          {!out && !canBuy && (
            <div className="card p-4 mt-5 text-sm flex gap-3 items-center bg-cream/60">
              <Store size={18} className="text-farm shrink-0" />
              <span>You're signed in as a <b>seller</b> — seller accounts can't purchase. <Link to="/seller" className="text-farm font-semibold">Manage your listings →</Link></span>
            </div>
          )}
          {out && <div className="mt-5"><Empty title="Currently out of stock" hint="Check related produce below or try again later." /></div>}

          <div className="card p-5 mt-4 space-y-3 text-sm">
            <div className="font-display font-bold text-base">Delivery options</div>
            <div className="flex gap-3 items-start"><Truck size={17} className="text-farm mt-0.5 shrink-0" /><span><b>Home delivery</b> in ~2 days · ₹40, <b className="text-farm">FREE over ₹499</b>. Choose a slot at checkout.</span></div>
            <div className="flex gap-3 items-start"><CalendarClock size={17} className="text-farm mt-0.5 shrink-0" /><span><b>Farm pickup</b> always free · ready next day.</span></div>
            <div className="flex gap-3 items-start"><ShieldCheck size={17} className="text-farm mt-0.5 shrink-0" /><span>Cash on Delivery, or clearly-labelled simulated online payment (demo).</span></div>
          </div>

          <div className="mt-8">
            <h2 className="font-display font-bold text-xl">Reviews {p.rating_count > 0 && <span className="text-sm font-sans text-muted">({p.rating_count})</span>}</h2>
            {(Array.isArray(reviews) ? reviews : []).length === 0 && <p className="text-sm text-muted mt-2">No reviews yet. Only buyers with completed orders can review.</p>}
            {(Array.isArray(reviews) ? reviews : []).map((r: any) => (
              <div key={r.id} className="card p-4 mt-2.5 text-sm">
                <Stars avg={r.rating} /> <b className="ml-1">{r.buyer_name}</b>
                <p className="text-muted mt-1">{r.comment}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="font-display font-bold text-xl mb-4">You may also like</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Array.isArray(related?.items) ? related.items : []).filter((x: any) => x.id !== p.id).slice(0, 4).map((x: any) => (
            <Link key={x.id} to={`/products/${x.id}`} className="card card-hover overflow-hidden group">
              <div className="img-frame h-36">
                {x.image_url ? <img src={x.image_url} alt={x.name} loading="lazy" onError={imgFallback} />
                  : <div className="w-full h-full grid place-items-center text-leaf"><Sprout size={32} /></div>}
              </div>
              <div className="p-3.5">
                <div className="font-bold text-sm leading-snug">{x.name}</div>
                <div className="mt-1"><Price value={x.price} unit={x.unit} /></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
