import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LocateFixed, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useLang } from '../lib/i18n'
import { Skeletons, Empty, ErrorBox } from '../components/common/ui'
import { ProductCard } from '../components/marketplace/ProductCard'
import { VoiceInput } from '../components/voice/VoiceInput'
import { SpeakButton } from '../components/voice/SpeakButton'
import { parseSearchCommand } from '../lib/voice-parser'
import { useDebounce } from '../lib/hooks'

export default function Marketplace() {
  const { t } = useLang()
  const { user } = useAuth()
  const nav = useNavigate()
  const canBuy = !user || user.role === 'buyer'
  const guardBuy = (fn: (p: any) => void) => (p: any) => {
    if (!user) { toast('Please log in as a buyer to shop.'); nav('/login'); return }
    fn(p)
  }
  const [params, setParams] = useSearchParams()
  const [drawer, setDrawer] = useState(false)
  const q = params.get('q') || ''
  const [draft, setDraft] = useState(q)
  const debounced = useDebounce(draft, 400)
  const [nearby, setNearby] = useState<any | null>(null)
  const [nearError, setNearError] = useState('')
  const [locating, setLocating] = useState(false)
  const autoNear = useRef(false)

  const filters = {
    q: debounced, category_id: params.get('cat') || '', sort: params.get('sort') || 'newest',
    in_stock: params.get('stock') === '1', page: Number(params.get('page') || 1),
    location: params.get('loc') || '', maxPrice: params.get('max') || '',
  }

  const cats = useQuery({ queryKey: ['cats'], queryFn: async () => (await api.get('/categories')).data })
  const products = useQuery({
    queryKey: ['products', filters],
    queryFn: async () => (await api.get('/products', {
      params: {
        q: filters.q || undefined, category_id: filters.category_id || undefined, sort: filters.sort,
        in_stock: filters.in_stock || undefined, page: filters.page, page_size: 12,
        location: filters.location || undefined, max_price: filters.maxPrice || undefined,
      }
    })).data
  })

  const locateNearby = (query?: string) => {
    setNearError('')
    if (!navigator.geolocation) {
      setNearError('This browser cannot access your location. Type a pickup area instead, or use filters.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { data } = await api.get('/products/nearby', {
            params: { lat: position.coords.latitude, lon: position.coords.longitude, q: query || undefined, radius_km: 50, page_size: 12 },
          })
          setNearby(data)
        } catch (e: any) {
          setNearError(apiError(e))
        } finally {
          setLocating(false)
        }
      },
      (error) => {
        setLocating(false)
        setNearError(error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Type a pickup area instead.'
          : 'Your location could not be determined. Try again or use the area filter.')
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  useEffect(() => {
    if (params.get('near') === '1' && !autoNear.current) {
      autoNear.current = true
      locateNearby(params.get('q') || draft)
    }
  }, [])

  const applyVoiceSearch = (text: string) => {
    const command = parseSearchCommand(text)
    const hasStructuredFilter = Boolean(command.location) || command.nearMe || command.maxPrice != null
    const nextQ = command.q || (hasStructuredFilter ? '' : text)
    setDraft(nextQ)
    const next = new URLSearchParams(params)
    if (nextQ) next.set('q', nextQ); else next.delete('q')
    if (command.location) next.set('loc', command.location); else next.delete('loc')
    if (command.maxPrice != null) next.set('max', String(command.maxPrice)); else next.delete('max')
    next.delete('page')
    setParams(next)
    if (command.nearMe) locateNearby(nextQ)
    else setNearby(null)
    toast.success('Search updated from your reviewed voice text.')
  }
  const wish = useMutation({
    mutationFn: (p: any) => api.post(`/wishlist/${p.id}`),
    onSuccess: () => toast.success('Saved to wishlist'),
    onError: (e: any) => toast.error(apiError(e))
  })
  const cart = useMutation({
    mutationFn: (p: any) => api.post('/cart/items', { product_id: p.id, quantity: Number(p.minimum_order_quantity) || 1 }),
    onSuccess: () => toast.success('Added to cart'),
    onError: (e: any) => toast.error(apiError(e))
  })

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params)
    if (!v) n.delete(k); else n.set(k, v)
    if (k !== 'page') n.delete('page')
    setParams(n)
    if (k === 'loc' || k === 'max') setNearby(null)
  }

  const activeCat = (Array.isArray(cats.data) ? cats.data : []).find((c: any) => String(c.id) === filters.category_id)

  const Filters = (
    <div className="space-y-5">
      <div>
        <div className="font-bold text-sm mb-2">Category</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => set('cat', '')} className={`badge border !py-1.5 !px-3 transition ${!filters.category_id ? 'bg-forest text-white border-forest' : 'bg-white border-line hover:border-farm'}`}>All</button>
          {(Array.isArray(cats.data) ? cats.data : []).map((c: any) => (
            <button key={c.id} onClick={() => set('cat', String(c.id))}
              className={`badge border !py-1.5 !px-3 transition ${filters.category_id === String(c.id) ? 'bg-forest text-white border-forest' : 'bg-white border-line hover:border-farm'}`}>{c.name}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="filter-location">Pickup area</label>
          <input id="filter-location" className="input" value={filters.location} onChange={(e) => set('loc', e.target.value)} placeholder="Erode" />
        </div>
        <div>
          <label className="label" htmlFor="filter-max">Max ₹ / unit</label>
          <input id="filter-max" type="number" min="0" className="input" value={filters.maxPrice} onChange={(e) => set('max', e.target.value)} placeholder="Budget" />
        </div>
      </div>
      <div>
        <div className="font-bold text-sm mb-2">Sort by</div>
        <select value={filters.sort} onChange={(e) => set('sort', e.target.value)} className="input" aria-label="Sort products">
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      <label className="flex items-center gap-2.5 text-sm font-semibold bg-cream rounded-xl px-3 py-2.5 cursor-pointer">
        <input type="checkbox" checked={filters.in_stock} onChange={(e) => set('stock', e.target.checked ? '1' : '')} className="accent-[#28784A] w-4 h-4" /> In stock only
      </label>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('action.search')}
            className="input !pl-11 !py-3 !rounded-2xl shadow-card" role="search" aria-label="Search products" />
        </div>
        <button className="btn-secondary md:hidden !rounded-2xl" onClick={() => setDrawer(true)} aria-label="Open filters"><SlidersHorizontal size={18} /></button>
      </div>

      <div className="card p-3 sm:p-4 mt-3 flex flex-col sm:flex-row gap-3 sm:items-center">
        <VoiceInput className="flex-1 !border-0 !p-0" label="Voice search" confirmLabel="Search"
          hint="Example: “Show tomatoes in Erode under 40 rupees” or “Find rice near me”."
          onConfirm={applyVoiceSearch} />
        <button type="button" className="btn-secondary !py-2.5 text-sm shrink-0" onClick={() => locateNearby(draft)}>
          <LocateFixed size={16} /> {locating ? 'Finding you…' : 'Near me'}
        </button>
      </div>

      {locating && <div className="card p-4 mt-3 text-sm text-muted">Requesting your location and comparing seller coordinates…</div>}
      {nearError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mt-3 text-sm text-amber-900" role="alert">
          {nearError}
          <button className="underline font-semibold ml-1" onClick={() => locateNearby(draft)}>Try again</button>
        </div>
      )}
      {nearby && (
        <section className="mt-5" aria-labelledby="nearby-heading">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 id="nearby-heading" className="font-display font-black text-xl text-forest flex items-center gap-1.5"><MapPin size={18} className="text-farm" /> Near you</h2>
              <p className="text-xs text-muted mt-0.5">{nearby.note || 'Straight-line estimate from seller profile coordinates.'}</p>
            </div>
            <div className="flex items-center gap-2">
              {nearby.items?.length ? (
                <SpeakButton text={`${nearby.total} products near you. ${nearby.items.slice(0, 3).map((p: any) => `${p.name}, ${p.price} rupees per ${p.unit}, about ${p.distance_km} kilometres away`).join('. ')}`} label="Read nearby results" compact />
              ) : null}
              <button className="text-sm text-muted underline" onClick={() => setNearby(null)}>Hide</button>
            </div>
          </div>
          {nearby.items?.length === 0 ? (
            <div className="mt-3"><Empty title="No products found near your location" hint="Sellers need reliable profile coordinates. Use the area filter or text search instead." /></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mt-3">
              {nearby.items.map((p: any) => (
                <ProductCard key={p.id} p={p} canBuy={canBuy}
                  onAdd={guardBuy((x) => cart.mutate(x))} onWish={guardBuy((x) => wish.mutate(x))} adding={cart.isPending} />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display font-black text-2xl text-forest">
          {activeCat ? activeCat.name : 'All produce'}
          {products.data && <span className="text-sm font-sans font-medium text-muted ml-2">· {products.data.total} items</span>}
        </h1>
        {products.data?.items?.length ? (
          <SpeakButton compact
            text={`${products.data.total} products found${filters.location ? ` in ${filters.location}` : ''}. ${products.data.items.slice(0, 3).map((p: any) => `${p.name}, ${p.price} rupees per ${p.unit} from ${p.farm_name || p.seller_name}`).join('. ')}`}
            label="Read results" />
        ) : null}
      </div>

      <div className="grid md:grid-cols-[250px_1fr] gap-6 mt-5">
        <aside className="hidden md:block card p-5 h-fit sticky top-24">{Filters}</aside>
        <div>
          {products.isLoading && <Skeletons />}
          {products.isError && <ErrorBox message={apiError(products.error)} onRetry={() => products.refetch()} />}
          {products.data && products.data.items.length === 0 && (
            <Empty title="No products match your current filters." hint="Try a different search or clear the category filter."
              action={<button className="btn-secondary" onClick={() => { setParams({}); setDraft(''); setNearby(null); setNearError('') }}>Clear filters</button>} />
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(Array.isArray(products.data?.items) ? products.data.items : []).map((p: any) => (
              <ProductCard key={p.id} p={p} canBuy={canBuy}
                onAdd={guardBuy((x) => cart.mutate(x))} onWish={guardBuy((x) => wish.mutate(x))} adding={cart.isPending} />
            ))}
          </div>
          {(products.data?.pages || 1) > 1 && (
            <div className="flex gap-2 justify-center mt-8">
              {Array.from({ length: products.data.pages }).map((_, i) => (
                <button key={i} onClick={() => set('page', String(i + 1))}
                  className={`min-w-10 h-10 px-3 rounded-xl border text-sm font-bold transition ${filters.page === i + 1 ? 'bg-forest text-white border-forest shadow' : 'bg-white border-line hover:border-farm'}`}>{i + 1}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-pine/50 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <div className="absolute right-0 top-0 h-full w-80 bg-white p-5 overflow-auto shadow-lift">
            <div className="flex justify-between items-center mb-4"><b className="font-display text-lg">Filters</b><button onClick={() => setDrawer(false)} className="btn-secondary !px-3 !py-1.5 text-sm">Close</button></div>
            {Filters}
            <button onClick={() => setDrawer(false)} className="btn-primary w-full mt-5">Show results</button>
          </div>
        </div>
      )}
    </div>
  )
}
