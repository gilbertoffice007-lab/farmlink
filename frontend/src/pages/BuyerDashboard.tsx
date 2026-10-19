import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ShoppingBasket, Heart, Truck, Bell, MapPin, ArrowRight, PackageSearch, Sparkles } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { queryClient } from '../lib/query-client'
import { Empty, StatusBadge } from '../components/common/ui'
import { ProductCard } from '../components/marketplace/ProductCard'

const TERMINAL = ['delivered', 'collected', 'cancelled', 'rejected']
const PIPE = ['placed', 'accepted', 'preparing', 'ready', 'dispatched', 'delivered']

export default function BuyerDashboard() {
  const { user } = useAuth()
  const { data: dash } = useQuery({ queryKey: ['buyer-dash'], queryFn: async () => (await api.get('/dashboard/buyer')).data })
  const { data: wishlist } = useQuery({ queryKey: ['wish'], queryFn: async () => (await api.get('/wishlist')).data })
  const { data: notifs } = useQuery({ queryKey: ['notifs'], queryFn: async () => (await api.get('/notifications')).data })
  const { data: cart } = useQuery({ queryKey: ['cart'], queryFn: async () => (await api.get('/cart')).data })
  const { data: addrs } = useQuery({ queryKey: ['addrs'], queryFn: async () => (await api.get('/addresses')).data })

  const recIds: string[] = dash?.recommended_ids || []
  const { data: recommended } = useQuery({
    queryKey: ['buyer-recs', recIds],
    queryFn: async () => (await Promise.all(recIds.slice(0, 4).map((id: string) => api.get(`/products/${id}`).then((r) => r.data)))),
    enabled: recIds.length > 0,
  })

  const cartMut = useMutation({
    mutationFn: (p: any) => api.post('/cart/items', { product_id: p.id, quantity: Number(p.minimum_order_quantity) || 1 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cart'] }); queryClient.invalidateQueries({ queryKey: ['cart-count'] }); toast.success('Added to cart') },
    onError: (e: any) => toast.error(apiError(e))
  })
  const wishMut = useMutation({
    mutationFn: (id: string) => api.delete(`/wishlist/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wish'] }); toast.success('Removed from wishlist') },
    onError: (e: any) => toast.error(apiError(e))
  })

  const active = (Array.isArray(dash?.recent_orders) ? dash.recent_orders : []).filter((o: any) => !TERMINAL.includes(o.status))
  const firstName = user?.full_name.split(' ')[0]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      {/* Shopping hero */}
      <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-forest to-pine text-white p-6 sm:p-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(500px_200px_at_90%_0%,rgba(185,217,122,.22),transparent)]" aria-hidden="true" />
        <div className="relative flex flex-wrap items-center gap-4 justify-between">
          <div>
            <p className="text-lime text-xs font-bold uppercase tracking-[0.14em]">My shopping</p>
            <h1 className="font-display font-black text-2xl sm:text-4xl mt-1">Vanakkam, {firstName} 👋</h1>
            <p className="text-white/70 text-sm mt-1">
              {active.length > 0 ? `${active.length} order${active.length > 1 ? 's' : ''} on the way · ` : 'Nothing in transit · '}
              {cart?.items?.length ? `${cart.items.length} item${cart.items.length > 1 ? 's' : ''} in your basket` : 'your basket is empty'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/market" className="btn-gold !py-2.5 text-sm">Shop fresh <ArrowRight size={15} /></Link>
            <Link to="/cart" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-white/25 hover:bg-white/10 transition">
              <ShoppingBasket size={16} /> Basket{cart?.items?.length ? ` (${cart.items.length})` : ''}
            </Link>
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-2 sm:gap-3 mt-5 max-w-lg">
          {[['Orders', dash?.total_orders ?? '—'], ['Spent', dash ? `₹${Number(dash.total_spent).toFixed(0)}` : '—'], ['Wishlist', dash?.wishlist_count ?? wishlist?.length ?? '—']].map(([l, v]) => (
            <div key={l as string} className="bg-white/10 border border-white/10 rounded-2xl px-3 py-2.5 text-center backdrop-blur">
              <div className="font-extrabold text-lg">{v}</div><div className="text-[11px] text-white/65">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active orders with live progress */}
      <h2 className="font-display font-bold text-xl mt-8 flex items-center gap-2"><Truck size={19} className="text-farm" /> On the way to you</h2>
      {active.length === 0 && (
        <div className="mt-3"><Empty title="No active orders" hint="Your live deliveries with progress bars will appear here."
          action={<Link to="/market" className="btn-primary">Start shopping</Link>} /></div>
      )}
      <div className="grid gap-3 mt-3 md:grid-cols-2">
        {active.map((o: any) => {
          const step = Math.max(0, PIPE.indexOf(o.status))
          const pct = Math.round(((step + 1) / PIPE.length) * 100)
          return (
            <Link key={o.id} to={`/orders/${o.id}`} className="card card-hover p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{o.order_number}</span>
                <StatusBadge status={o.status} />
                <span className="ml-auto font-extrabold">₹{Number(o.total_amount).toFixed(0)}</span>
              </div>
              <div className="h-2 rounded-full bg-line/70 mt-3 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Order ${o.order_number} progress`}>
                <div className="h-full rounded-full bg-gradient-to-r from-leaf to-farm" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-muted mt-1.5 capitalize">{o.status} · step {step + 1} of {PIPE.length} → tap to track live</div>
            </Link>
          )
        })}
      </div>

      {/* Wishlist + recommendations */}
      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        <div>
          <h2 className="font-display font-bold text-xl flex items-center gap-2"><Heart size={18} className="text-farm" /> Your wishlist</h2>
          {(Array.isArray(wishlist) ? wishlist : []).length === 0 && <p className="text-sm text-muted mt-2">Tap the heart on any product to save it here.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {(Array.isArray(wishlist) ? wishlist : []).slice(0, 4).map((p: any) => (
              <ProductCard key={p.id} p={p} onAdd={(x) => cartMut.mutate(x)} onWish={(x) => wishMut.mutate(x.id)} adding={cartMut.isPending} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display font-bold text-xl flex items-center gap-2"><Sparkles size={18} className="text-farm" /> Recommended for you</h2>
          <p className="text-xs text-muted mt-1">Based on what's popular in categories you browse.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {(Array.isArray(recommended) ? recommended : []).map((p: any) => (
              <ProductCard key={p.id} p={p} onAdd={(x) => cartMut.mutate(x)}
                onWish={(x) => api.post(`/wishlist/${x.id}`).then(() => { queryClient.invalidateQueries({ queryKey: ['wish'] }); toast.success('Saved') }).catch((e) => toast.error(apiError(e)))}
                adding={cartMut.isPending} />
            ))}
            {(!recommended || recommended.length === 0) && (
              <div className="sm:col-span-2 card p-5 text-sm text-muted flex items-center gap-2"><PackageSearch size={16} /> Browse the marketplace and picks will appear here.</div>
            )}
          </div>
        </div>
      </div>

      {/* Addresses + notifications */}
      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        <div className="card p-5">
          <div className="flex justify-between items-center"><h2 className="font-bold flex items-center gap-2"><MapPin size={17} className="text-farm" /> Delivery addresses</h2><Link to="/checkout" className="text-farm text-sm font-semibold">Manage</Link></div>
          {(Array.isArray(addrs) ? addrs : []).length === 0 && <p className="text-sm text-muted mt-2">No saved address yet — add one at checkout.</p>}
          {(Array.isArray(addrs) ? addrs : []).slice(0, 3).map((a: any) => (
            <div key={a.id} className="text-sm py-2 border-b border-line/70 last:border-0"><b>{a.recipient_name}</b> <span className="text-muted">· {a.address_line}, {a.city}</span></div>
          ))}
        </div>
        <div className="card p-5">
          <h2 className="font-bold flex items-center gap-2"><Bell size={17} className="text-farm" /> Notifications</h2>
          {(Array.isArray(notifs) ? notifs : []).length === 0 && <p className="text-sm text-muted mt-2">You're all caught up.</p>}
          {(Array.isArray(notifs) ? notifs : []).slice(0, 4).map((n: any) => (
            <div key={n.id} className="text-sm py-2 border-b border-line/70 last:border-0"><b>{n.title}</b><div className="text-muted">{n.message}</div></div>
          ))}
          {(Array.isArray(notifs) ? notifs : []).length > 0 && <Link to="/notifications" className="text-farm text-sm font-semibold mt-2 inline-block">View all</Link>}
        </div>
      </div>
    </div>
  )
}
