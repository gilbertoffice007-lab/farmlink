import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Search, SlidersHorizontal } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useLang } from '../lib/i18n'
import { Skeletons, Empty, ErrorBox } from '../components/common/ui'
import { ProductCard } from '../components/marketplace/ProductCard'
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

  const filters = {
    q: debounced, category_id: params.get('cat') || '', sort: params.get('sort') || 'newest',
    in_stock: params.get('stock') === '1', page: Number(params.get('page') || 1)
  }

  const cats = useQuery({ queryKey: ['cats'], queryFn: async () => (await api.get('/categories')).data })
  const products = useQuery({
    queryKey: ['products', filters],
    queryFn: async () => (await api.get('/products', {
      params: { q: filters.q || undefined, category_id: filters.category_id || undefined, sort: filters.sort, in_stock: filters.in_stock || undefined, page: filters.page, page_size: 12 }
    })).data
  })
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
  }

  const activeCat = (cats.data || []).find((c: any) => String(c.id) === filters.category_id)

  const Filters = (
    <div className="space-y-5">
      <div>
        <div className="font-bold text-sm mb-2">Category</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => set('cat', '')} className={`badge border !py-1.5 !px-3 transition ${!filters.category_id ? 'bg-forest text-white border-forest' : 'bg-white border-line hover:border-farm'}`}>All</button>
          {(cats.data || []).map((c: any) => (
            <button key={c.id} onClick={() => set('cat', String(c.id))}
              className={`badge border !py-1.5 !px-3 transition ${filters.category_id === String(c.id) ? 'bg-forest text-white border-forest' : 'bg-white border-line hover:border-farm'}`}>{c.name}</button>
          ))}
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

      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display font-black text-2xl text-forest">
          {activeCat ? activeCat.name : 'All produce'}
          {products.data && <span className="text-sm font-sans font-medium text-muted ml-2">· {products.data.total} items</span>}
        </h1>
      </div>

      <div className="grid md:grid-cols-[250px_1fr] gap-6 mt-5">
        <aside className="hidden md:block card p-5 h-fit sticky top-24">{Filters}</aside>
        <div>
          {products.isLoading && <Skeletons />}
          {products.isError && <ErrorBox message={apiError(products.error)} onRetry={() => products.refetch()} />}
          {products.data && products.data.items.length === 0 && (
            <Empty title="No products match your current filters." hint="Try a different search or clear the category filter."
              action={<button className="btn-secondary" onClick={() => { setParams({}); setDraft('') }}>Clear filters</button>} />
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(products.data?.items || []).map((p: any) => (
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
