import { useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Store, BadgeCheck, TriangleAlert, Check, X, Search, Route, LineChart as ChartIcon, RefreshCw, Leaf, Truck, Mic } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api, apiError } from '../lib/api'
import { queryClient } from '../lib/query-client'
import { Empty, StatusBadge } from '../components/common/ui'

const ORDER_FILTERS = ['all', 'placed', 'accepted', 'preparing', 'ready', 'dispatched', 'delivered'] as const

export default function SellerDashboard() {
  const [tab, setTab] = useState<'overview' | 'products' | 'orders'>('overview')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('all')
  const dash = useQuery({ queryKey: ['seller-dash'], queryFn: async () => (await api.get('/dashboard/seller')).data, refetchInterval: 30_000, refetchOnWindowFocus: true })
  const mine = useQuery({ queryKey: ['mine'], queryFn: async () => (await api.get('/products/mine')).data, refetchOnWindowFocus: true })
  const orders = useQuery({ queryKey: ['orders'], queryFn: async () => (await api.get('/orders')).data, refetchInterval: 30_000, refetchOnWindowFocus: true })
  const profile = useQuery({ queryKey: ['seller-profile'], queryFn: async () => (await api.get('/sellers/me')).data, retry: false })
  const demand = useQuery({ queryKey: ['seller-demand'], queryFn: async () => (await api.get('/analytics/demand')).data, refetchInterval: 60_000 })
  const rescueMine = useQuery({ queryKey: ['rescue-mine'], queryFn: async () => (await api.get('/rescue/listings/mine')).data, retry: false })
  const transportMine = useQuery({ queryKey: ['shipments-mine'], queryFn: async () => (await api.get('/transport/shipments/mine')).data, retry: false })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mine'] }); queryClient.invalidateQueries({ queryKey: ['seller-dash'] }); toast.success('Listing deactivated') },
    onError: (e: any) => toast.error(apiError(e))
  })
  const decide = useMutation({
    mutationFn: ({ id, ok }: any) => api.post(`/orders/${id}/${ok ? 'accept' : 'reject'}`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); queryClient.invalidateQueries({ queryKey: ['seller-dash'] }); toast.success('Order updated') },
    onError: (e: any) => toast.error(apiError(e))
  })
  const advance = useMutation({
    mutationFn: ({ id, next }: any) => api.post(`/orders/${id}/status`, { status: next }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); toast.success('Status updated') },
    onError: (e: any) => toast.error(apiError(e))
  })

  const d = dash.data
  const pending = useMemo(() => (orders.data || []).filter((o: any) => o.status === 'placed'), [orders.data])
  const lowStock = useMemo(() => (demand.data?.restock_suggestions || []).slice(0, 4), [demand.data])
  const rescueOffers = useMemo(
    () => (Array.isArray(rescueMine.data) ? rescueMine.data.reduce((sum: number, l: any) => sum + Number(l.pending_offer_count || 0), 0) : 0),
    [rescueMine.data],
  )
  const activeLoads = useMemo(
    () => (Array.isArray(transportMine.data) ? transportMine.data.filter((s: any) => !['delivered', 'cancelled', 'failed'].includes(s.status)).length : 0),
    [transportMine.data],
  )
  const filteredProducts = useMemo(() => {
    const list = mine.data || []
    if (!q.trim()) return list
    const s = q.trim().toLowerCase()
    return list.filter((p: any) => p.name.toLowerCase().includes(s) || (p.location || '').toLowerCase().includes(s))
  }, [mine.data, q])
  const filteredOrders = useMemo(() => {
    const list = orders.data || []
    return status === 'all' ? list : list.filter((o: any) => o.status === status)
  }, [orders.data, status])

  const NEXT_STEP: Record<string, string> = { accepted: 'preparing', preparing: 'ready', ready: 'dispatched', dispatched: 'delivered' }
  const verified = profile.data?.verification_status === 'approved'

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      {/* Farm identity header */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-forest to-pine text-white px-5 sm:px-6 py-5 flex flex-wrap items-center gap-4">
          <span className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 grid place-items-center shrink-0"><Store size={22} className="text-lime" /></span>
          <div className="flex-1 min-w-40">
            <h1 className="font-display font-black text-xl sm:text-2xl leading-tight">{profile.data?.farm_name || 'Your farm'}</h1>
            <p className="text-white/65 text-xs sm:text-sm mt-0.5">
              {[profile.data?.city, profile.data?.state].filter(Boolean).join(', ') || 'Add your location in onboarding'}
              {' · '}{mine.data ? `${mine.data.filter((p: any) => p.status === 'active').length} live listings` : ''}
            </p>
          </div>
          {profile.data
            ? <span className={`badge !py-1 !px-3 ${verified ? 'bg-lime/20 text-lime border border-lime/30' : 'bg-amber-400/20 text-amber-200 border border-amber-300/30'}`}>
                {verified ? <><BadgeCheck size={13} /> Verified farm</> : `Verification: ${profile.data.verification_status}`}
              </span>
            : <Link to="/onboarding" className="badge !py-1.5 !px-3.5 bg-gold text-pine font-bold">Complete farm setup →</Link>}
          <Link to="/seller/products/new" className="btn-gold !py-2.5 text-sm no-print"><Plus size={16} /> New listing</Link>
        </div>
        {/* Action inbox */}
        {(pending.length > 0 || lowStock.length > 0) && (
          <div className="px-5 sm:px-6 py-4 grid sm:grid-cols-2 gap-3 bg-amber-50/60 border-t border-amber-200/60">
            {pending.length > 0 && (
              <button onClick={() => { setTab('orders'); setStatus('placed') }} className="text-left rounded-2xl border border-amber-300 bg-white p-3.5 hover:shadow-card transition">
                <div className="font-extrabold text-amber-800">🔔 {pending.length} new order{pending.length > 1 ? 's' : ''} need{pending.length > 1 ? '' : 's'} your decision</div>
                <div className="text-xs text-muted mt-0.5">Tap to review & accept — buyers wait on you.</div>
              </button>
            )}
            {lowStock.length > 0 && (
              <div className="rounded-2xl border border-amber-300 bg-white p-3.5">
                <div className="font-extrabold text-amber-800 flex items-center gap-1.5"><TriangleAlert size={15} /> Running low</div>
                <div className="text-xs text-muted mt-1">{lowStock.map((s: any) => `${s.product} (${s.stock} left)`).join(' · ')}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        <Link to="/rescue/manage" className="card card-hover p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-farm-light text-farm grid place-items-center shrink-0"><Leaf size={19} /></span>
          <div className="min-w-0"><div className="font-bold">Harvest Rescue</div><div className="text-xs text-muted">{rescueMine.data ? `${rescueMine.data.length} listing${rescueMine.data.length === 1 ? '' : 's'} · ${rescueOffers} pending offer${rescueOffers === 1 ? '' : 's'}` : 'Sell surplus before the deadline'}</div></div>
        </Link>
        <Link to="/transport" className="card card-hover p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-farm-light text-farm grid place-items-center shrink-0"><Truck size={19} /></span>
          <div className="min-w-0"><div className="font-bold">Shared Transport</div><div className="text-xs text-muted">{transportMine.data ? `${activeLoads} active shared load${activeLoads === 1 ? '' : 's'}` : 'Fill spare capacity and split costs'}</div></div>
        </Link>
        <Link to="/voice" className="card card-hover p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-farm-light text-farm grid place-items-center shrink-0"><Mic size={19} /></span>
          <div className="min-w-0"><div className="font-bold">Voice Assistant</div><div className="text-xs text-muted">Search, list and hear updates</div></div>
        </Link>
      </div>

      {/* KPI band — dark business strip, distinct from buyer */}
      {dash.isError ? (
        <div className="card p-5 mt-4 border-red-200 bg-red-50 text-sm flex flex-wrap gap-3 items-center" role="alert">
          <span><b>Couldn't load your numbers.</b> Check your connection and try again.</span>
          <button onClick={() => dash.refetch()} className="btn-secondary !px-3.5 !py-1.5 text-sm">Retry</button>
        </div>
      ) : (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
        {[
          ['Revenue', d ? `₹${Number(d.revenue).toFixed(0)}` : '…', 'from fulfilled sales'],
          ['Total orders', d?.total_orders ?? '…', `${d?.pending_orders ?? 0} awaiting decision`],
          ['Live listings', d?.active_listings ?? '…', 'visible in marketplace'],
          ['Stock on hand', d ? `${Number(d.inventory).toFixed(0)} units` : '…', 'across live listings'],
          ['Repeat demand', demand.data && !demand.data.limited_data ? `${demand.data.top_products?.length || 0} hot items` : 'building…', 'from order history'],
        ].map(([l, v, s]) => (
          <div key={l as string} className="rounded-2xl bg-pine text-white p-4 border border-white/10">
            <div className="text-[11px] uppercase tracking-wider text-white/55 font-bold">{l}</div>
            <div className="font-display font-black text-2xl mt-0.5">{dash.isLoading ? '•••' : v}</div>
            <div className="text-[11px] text-white/50 mt-0.5">{s}</div>
          </div>
        ))}
      </div>
      )}

      <div className="flex gap-2 mt-5 flex-wrap items-center" role="tablist" aria-label="Seller sections">
        {(['overview', 'products', 'orders'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition ${tab === t ? 'bg-forest text-white shadow' : 'bg-white border border-line hover:border-farm'}`}>{t}</button>
        ))}
        <button
          onClick={() => { dash.refetch(); orders.refetch(); mine.refetch(); demand.refetch() }}
          className="btn-secondary !px-3.5 !py-2 text-sm inline-flex items-center gap-1.5" aria-label="Refresh dashboard data">
          <RefreshCw size={15} className={dash.isFetching ? 'animate-spin' : ''} />
          {dash.dataUpdatedAt ? `Updated ${new Date(dash.dataUpdatedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}` : 'Refresh'}
        </button>
        <div className="ml-auto flex gap-2">
          <Link to="/logistics" className="btn-secondary !px-3.5 !py-2 text-sm inline-flex items-center gap-1.5"><Route size={15} /> Delivery runs</Link>
          <Link to="/insights" className="btn-secondary !px-3.5 !py-2 text-sm inline-flex items-center gap-1.5"><ChartIcon size={15} /> Insights</Link>
        </div>
      </div>

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-4 mt-4">
          <div className="card p-5">
            <h2 className="font-display font-bold text-lg">Sales — last 14 days</h2>
            <div className="h-56 mt-2">
              <ResponsiveContainer><LineChart data={d?.sales_by_day || []}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                <Line type="monotone" dataKey="total" stroke="#28784A" strokeWidth={2} dot={false} />
              </LineChart></ResponsiveContainer>
            </div>
            {(!d?.sales_by_day || d.sales_by_day.length === 0) && <p className="text-xs text-muted">No sales in this window yet — figures update from real orders.</p>}
          </div>
          <div className="card p-5">
            <h2 className="font-display font-bold text-lg">Best sellers</h2>
            {(d?.best_sellers || []).length === 0 && <p className="text-sm text-muted mt-2">No sales yet — share your listings to get the first order.</p>}
            {(d?.best_sellers || []).map((b: any) => (
              <div key={b.name} className="flex justify-between text-sm py-2 border-b border-line/70 last:border-0"><span className="font-semibold">{b.name}</span><span>{b.qty} sold · ₹{Number(b.total).toFixed(0)}</span></div>
            ))}
            {lowStock.length > 0 && (
              <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-3.5">
                <div className="font-bold text-sm text-amber-800">Restock radar</div>
                {lowStock.map((s: any) => <div key={s.product} className="text-xs mt-1"><b>{s.product}</b> — {s.stock} left, {s.ordered_qty} ordered recently</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="mt-4">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-44">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your listings…" className="input !pl-9" aria-label="Search listings" />
            </div>
            <Link to="/seller/products/new" className="btn-primary !py-2.5 text-sm"><Plus size={15} /> Add product</Link>
          </div>
          {(!mine.data || mine.data.length === 0) && <div className="mt-4"><Empty title="No listings yet" hint="Publish your first product to appear in the marketplace." action={<Link to="/seller/products/new" className="btn-primary">Add product</Link>} /></div>}
          {/* Desktop table / mobile cards */}
          <div className="card mt-4 overflow-x-auto hidden md:block">
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-left text-muted border-b border-line"><th className="p-3.5">Product</th><th className="p-3.5">Price</th><th className="p-3.5">Stock</th><th className="p-3.5">Status</th><th className="p-3.5 text-right">Actions</th></tr></thead>
              <tbody>
                {filteredProducts.map((p: any) => (
                  <tr key={p.id} className="border-b border-line/70 last:border-0 hover:bg-cream/60">
                    <td className="p-3.5"><b>{p.name}</b><div className="text-xs text-muted">{p.location || ''} · min {p.minimum_order_quantity} {p.unit}</div></td>
                    <td className="p-3.5 font-bold">₹{Number(p.price).toFixed(2)}/{p.unit}</td>
                    <td className="p-3.5">{Number(p.available_quantity) <= 10 ? <b className="text-amber-700">{p.available_quantity} ⚠</b> : p.available_quantity} {p.unit}</td>
                    <td className="p-3.5"><StatusBadge status={p.status} /></td>
                    <td className="p-3.5"><div className="flex gap-1.5 justify-end">
                      <Link to={`/seller/products/${p.id}/edit`} className="btn-secondary !px-3 !py-1.5 text-xs inline-flex items-center gap-1"><Pencil size={13} /> Edit</Link>
                      <button aria-label={`Deactivate ${p.name}`} onClick={() => { if (confirm(`Deactivate ${p.name}?`)) del.mutate(p.id) }} className="btn-secondary !px-3 !py-1.5 text-xs text-red-600 inline-flex items-center gap-1"><Trash2 size={13} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 mt-4 md:hidden">
            {filteredProducts.map((p: any) => (
              <div key={p.id} className="card p-4">
                <div className="flex justify-between items-start gap-2">
                  <div><div className="font-bold">{p.name}</div>
                    <div className="text-sm text-muted">₹{Number(p.price).toFixed(2)}/{p.unit} · {p.available_quantity} left</div></div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex gap-2 mt-3">
                  <Link to={`/seller/products/${p.id}/edit`} className="btn-secondary !px-3 !py-2 text-sm flex-1 inline-flex justify-center items-center gap-1"><Pencil size={14} /> Edit</Link>
                  <button aria-label={`Deactivate ${p.name}`} onClick={() => { if (confirm(`Deactivate ${p.name}?`)) del.mutate(p.id) }} className="btn-secondary !px-3 !py-2 text-sm text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="mt-4">
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter orders by status">
            {ORDER_FILTERS.map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`badge border !py-1.5 !px-3 capitalize transition ${status === s ? 'bg-forest text-white border-forest' : 'bg-white border-line hover:border-farm'}`}>{s}</button>
            ))}
          </div>
          <div className="space-y-3 mt-4">
            {filteredOrders.length === 0 && <Empty title="No orders here" hint={status === 'placed' ? 'New orders from buyers will land here for your decision.' : 'Orders with this status will appear here.'} />}
            {filteredOrders.map((o: any) => (
              <div key={o.id} className="card p-4">
                <Link to={`/orders/${o.id}`} className="flex items-center gap-3 hover:opacity-80">
                  <div className="flex-1 min-w-0"><div className="font-bold">{o.order_number}</div>
                    <div className="text-sm text-muted truncate">{o.buyer_name} · ₹{Number(o.total_amount).toFixed(2)}{o.delivery_slot ? ` · slot ${o.delivery_slot}` : ''}</div></div>
                  <StatusBadge status={o.status} />
                </Link>
                {o.status === 'placed' && (
                  <div className="flex gap-2 mt-3 no-print">
                    <button disabled={decide.isPending} onClick={() => decide.mutate({ id: o.id, ok: true })}
                      className="btn-primary !px-4 !py-2 text-sm flex-1 inline-flex justify-center items-center gap-1.5"><Check size={15} /> Accept</button>
                    <button disabled={decide.isPending} onClick={() => { if (confirm(`Reject order ${o.order_number}? Stock returns to your listing.`)) decide.mutate({ id: o.id, ok: false }) }}
                      className="btn-secondary !px-4 !py-2 text-sm flex-1 inline-flex justify-center items-center gap-1.5"><X size={15} /> Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
