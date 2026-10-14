import { Link } from 'react-router-dom'
import { Heart, Plus, Sprout, MapPin, Store } from 'lucide-react'
import { Stars, VegMark } from '../common/ui'
import { imgFallback } from '../../lib/images'

export function Price({ value, unit, big }: { value: number | string; unit: string; big?: boolean }) {
  return (
    <span className={`font-extrabold text-forest ${big ? 'text-3xl' : 'text-lg'}`}>
      ₹{Number(value).toFixed(big ? 2 : 0)}
      <span className="text-xs font-medium text-muted"> /{unit}</span>
    </span>
  )
}

export function ProductCard({ p, onAdd, onWish, adding, canBuy = true }: {
  p: any; onAdd?: (p: any) => void; onWish?: (p: any) => void; adding?: boolean; canBuy?: boolean
}) {
  const out = Number(p.available_quantity) <= 0
  return (
    <div className="card card-hover overflow-hidden group flex flex-col">
      <Link to={`/products/${p.id}`} className="img-frame h-48 block" aria-label={p.name}>
        {p.image_url
          ? <img src={p.image_url} alt={p.name} loading="lazy" onError={imgFallback} />
          : <div className="w-full h-full grid place-items-center text-leaf"><Sprout size={44} /></div>}
        <span className="absolute top-2.5 left-2.5 badge bg-white/95 text-forest shadow">{p.category_name || 'Produce'}</span>
        {out && <span className="absolute inset-0 bg-pine/45 grid place-items-center"><span className="badge bg-white text-red-700 font-bold">Out of stock</span></span>}
        {!out && Number(p.available_quantity) <= 10 && (
          <span className="absolute bottom-2.5 left-2.5 badge bg-amber-400/95 text-amber-950">Only {p.available_quantity} {p.unit} left</span>
        )}
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/products/${p.id}`} className="font-bold leading-snug hover:text-farm transition line-clamp-2">{p.name}</Link>
          <VegMark />
        </div>
        <div className="text-xs text-muted mt-1 inline-flex items-center gap-1">
          <MapPin size={11} /> {p.farm_name || p.seller_name}{p.location ? ` · ${p.location}` : ''}
        </div>
        <div className="mt-1.5"><Stars avg={p.rating_avg} count={p.rating_count} /></div>
        <div className="mt-2 flex items-end justify-between">
          <Price value={p.price} unit={p.unit} />
        </div>
        <div className="flex gap-2 mt-3 pt-1">
          {canBuy ? (
            <>
              <button disabled={out || adding} onClick={() => onAdd?.(p)}
                className="btn-primary !px-3 !py-2 text-sm flex-1 disabled:opacity-40">
                <Plus size={15} /> Add
              </button>
              <button onClick={() => onWish?.(p)} aria-label={`Save ${p.name} to wishlist`}
                className="btn-secondary !px-2.5 !py-2 hover:!border-red-300 hover:text-red-600"><Heart size={16} /></button>
            </>
          ) : (
            <Link to="/seller" className="btn-secondary !px-3 !py-2 text-xs flex-1 inline-flex justify-center items-center gap-1.5 text-muted">
              <Store size={13} /> Sellers can't buy — manage listings
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
