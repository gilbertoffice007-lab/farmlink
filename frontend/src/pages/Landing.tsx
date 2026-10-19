import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Leaf, HandCoins, Search, Truck, Bike, ShieldCheck, CalendarClock, PackageCheck, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useLang } from '../lib/i18n'
import { IMG, CATEGORY_IMG, imgFallback } from '../lib/images'
import { ProductCard } from '../components/marketplace/ProductCard'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { apiError } from '../lib/api'

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' }
}

function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items]
  return (
    <div className="bg-forest text-white/90 py-3 overflow-hidden marquee-mask no-print" aria-hidden="true">
      <div className="marquee-track">
        {row.map((x, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap px-2">
            <Leaf size={13} className="text-lime" /> {x}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Landing() {
  const { t } = useLang()
  const { user } = useAuth()
  const nav = useNavigate()
  const canBuy = !user || user.role === 'buyer'
  const guardBuy = (fn: (p: any) => void) => (p: any) => {
    if (!user) { toast('Please log in as a buyer to shop.'); nav('/login'); return }
    fn(p)
  }
  const { data: featured } = useQuery({
    queryKey: ['featured'], queryFn: async () => (await api.get('/products/featured')).data
  })
  const { data: cats } = useQuery({
    queryKey: ['cats'], queryFn: async () => (await api.get('/categories')).data
  })
  // Guard: API misconfig (e.g. HTML fallback) must never white-screen the app.
  const catsArr = Array.isArray(cats) ? cats : []
  const featuredArr = Array.isArray(featured) ? featured : []
  const { data: stats } = useQuery({
    queryKey: ['site-stats'], queryFn: async () => (await api.get('/stats')).data
  })
  const cart = useMutation({
    mutationFn: (p: any) => api.post('/cart/items', { product_id: p.id, quantity: Number(p.minimum_order_quantity) || 1 }),
    onSuccess: () => toast.success('Added to cart'), onError: (e: any) => toast.error(apiError(e))
  })
  const wish = useMutation({
    mutationFn: (p: any) => api.post(`/wishlist/${p.id}`),
    onSuccess: () => toast.success('Saved to wishlist'), onError: (e: any) => toast.error(apiError(e))
  })

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-pine text-white">
        <div className="absolute inset-0 bg-[radial-gradient(900px_420px_at_85%_-10%,rgba(185,217,122,.25),transparent),radial-gradient(700px_380px_at_10%_110%,rgba(40,120,74,.5),transparent)]" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-4 pt-12 pb-14 grid lg:grid-cols-2 gap-10 items-center relative">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <span className="badge bg-white/10 text-lime border border-white/15"><Leaf size={13} /> Direct farmer marketplace</span>
            <h1 className="font-display font-black text-[30px] sm:text-6xl leading-[1.05] sm:leading-[1.02] mt-4">
              Fresh From Farms.<br /><span className="text-lime">Fair For Everyone.</span>
            </h1>
            <p className="text-white/70 text-lg mt-4 max-w-lg leading-relaxed">FarmLink connects farmers and FPOs directly with homes, retailers and restaurants — transparent farm-gate prices, harvest-fresh produce, and delivery to your doorstep.</p>
            <div className="flex flex-wrap gap-3 mt-7">
              <Link to="/market" className="btn-primary !px-6 !py-3">{t('cta.explore')} <ArrowRight size={17} /></Link>
              <Link to="/register" className="inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold border border-white/25 hover:bg-white/10 transition">{t('cta.sell')}</Link>
            </div>
            <div className="flex flex-wrap gap-2 mt-6 text-xs">
              <span className="badge bg-white/10 border border-white/15 text-white/85"><Truck size={12} className="text-lime" /> Free delivery ₹499+</span>
              <span className="badge bg-white/10 border border-white/15 text-white/85"><CalendarClock size={12} className="text-lime" /> Delivery slots</span>
              <span className="badge bg-white/10 border border-white/15 text-white/85"><ShieldCheck size={12} className="text-lime" /> Verified farms</span>
            </div>
            {/* Mobile hero visual (collage is sm+ only) */}
            <div className="sm:hidden mt-7 rounded-3xl overflow-hidden border border-white/15 img-frame h-56">
              <img src={IMG.heroMain} alt="Farmer holding freshly harvested produce" loading="lazy" onError={imgFallback} />
              <span className="absolute bottom-3 left-3 badge bg-white/95 text-forest shadow">Harvest-fresh · direct from farms</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative hidden sm:block">
            <div className="grid grid-cols-5 grid-rows-2 gap-3 h-[420px]">
              <div className="col-span-3 row-span-2 rounded-3xl overflow-hidden border border-white/15 shadow-lift img-frame">
                <img src={IMG.heroMain} alt="Farmer holding freshly harvested produce" onError={imgFallback} />
              </div>
              <div className="col-span-2 rounded-3xl overflow-hidden border border-white/15 img-frame">
                <img src={IMG.heroMarket} alt="Fresh vegetables at a farm stall" loading="lazy" onError={imgFallback} />
              </div>
              <div className="col-span-2 rounded-3xl overflow-hidden border border-white/15 img-frame">
                <img src={IMG.heroField} alt="Green farm field" loading="lazy" onError={imgFallback} />
              </div>
            </div>
            <div className="absolute -left-4 bottom-8 card !rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lift animate-floaty">
              <span className="w-10 h-10 rounded-xl bg-farm-light text-farm grid place-items-center"><PackageCheck size={20} /></span>
              <div><div className="text-sm font-extrabold text-forest">Order delivered</div><div className="text-xs text-muted">Tracked · 2 days</div></div>
            </div>
            <div className="absolute -right-2 top-6 card !rounded-2xl px-4 py-3 shadow-lift animate-floaty" style={{ animationDelay: '1.2s' }}>
              <div className="text-xs text-muted font-semibold">Tomatoes · Erode</div>
              <div className="font-extrabold text-forest">₹68 <span className="text-xs font-medium text-muted">/kg</span></div>
            </div>
          </motion.div>
        </div>
        <Marquee items={catsArr.length ? catsArr.map((c: any) => c.name) : ['Vegetables', 'Fruits', 'Grains', 'Pulses', 'Spices', 'Organic']} />
      </section>

      {/* LIVE STATS — real marketplace counters, no fabricated figures */}
      <section className="max-w-7xl mx-auto px-4 -mt-0 pt-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            [`${stats?.products ?? '—'}`, 'Live farm listings'],
            [`${stats?.categories ?? '—'}`, 'Product categories'],
            [`${stats?.sellers ?? '—'}`, 'Registered sellers'],
            [`${stats?.orders ?? '—'}`, 'Orders placed'],
          ].map(([v, l]) => (
            <motion.div key={l} {...fadeUp} className="card card-hover p-5 text-center">
              <div className="font-display font-black text-3xl text-forest">{v}</div>
              <div className="text-xs text-muted mt-1 font-medium">{l}</div>
            </motion.div>
          ))}
        </div>
        <p className="text-[11px] text-muted mt-2">Live numbers from the marketplace database right now.</p>
      </section>

      {/* CATEGORIES */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <motion.div {...fadeUp} className="flex flex-wrap items-end justify-between gap-2 mb-5">
          <div>
            <span className="eyebrow">Shop by category</span>
            <h2 className="font-display font-black text-2xl sm:text-3xl text-forest mt-2">What’s fresh today?</h2>
          </div>
          <Link to="/market" className="text-farm font-semibold text-sm inline-flex items-center gap-1 hover:gap-2 transition-all">View all <ArrowRight size={15} /></Link>
        </motion.div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {catsArr.map((c: any, i: number) => (
            <motion.div key={c.id} {...fadeUp}>
              <Link to={`/market?cat=${c.id}`} className="card card-hover overflow-hidden block group">
                <div className="img-frame h-28">
                  <img src={CATEGORY_IMG[c.slug]} alt={c.name} loading="lazy" onError={imgFallback} />
                  <span className="absolute inset-0 bg-gradient-to-t from-pine/60 to-transparent" aria-hidden="true" />
                  <span className="absolute bottom-2 left-2.5 right-2 text-white font-bold text-sm leading-tight">{c.name}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section className="bg-white border-y border-line">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <motion.div {...fadeUp} className="flex flex-wrap items-end justify-between gap-2 mb-5">
            <div>
              <span className="eyebrow">Handpicked for you</span>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-forest mt-2">Featured harvest</h2>
            </div>
            <Link to="/market" className="text-farm font-semibold text-sm inline-flex items-center gap-1 hover:gap-2 transition-all">View all <ArrowRight size={15} /></Link>
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredArr.slice(0, 8).map((p: any) => (
              <ProductCard key={p.id} p={p} canBuy={canBuy}
                onAdd={guardBuy((x) => cart.mutate(x))} onWish={guardBuy((x) => wish.mutate(x))} adding={cart.isPending} />
            ))}
          </div>
        </div>
      </section>

      {/* DELIVERY */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <motion.div {...fadeUp} className="rounded-3xl overflow-hidden bg-gradient-to-br from-forest to-pine text-white grid lg:grid-cols-2 relative">
          <div className="absolute inset-0 bg-[radial-gradient(600px_300px_at_90%_10%,rgba(185,217,122,.2),transparent)]" aria-hidden="true" />
          <div className="p-6 sm:p-12 relative">
            <span className="badge bg-white/10 text-lime border border-white/15"><Bike size={13} /> Farm-to-door delivery</span>
            <h2 className="font-display font-black text-3xl sm:text-4xl mt-3">Delivery that fits your day.</h2>
            <ul className="mt-5 space-y-3 text-[15px] text-white/80">
              {[['Pick a slot', 'Today evening or tomorrow morning/evening windows at checkout.'], ['Free over ₹499', 'Flat ₹40 otherwise — shown transparently before you pay.'], ['Live tracking', 'Placed → accepted → preparing → on the way → delivered, with timestamps.']].map(([h, p]) => (
                <li key={h} className="flex gap-3"><span className="w-6 h-6 rounded-full bg-lime/20 text-lime grid place-items-center shrink-0 mt-0.5">✓</span><span><b className="text-white">{h}.</b> {p}</span></li>
              ))}
            </ul>
            <Link to="/market" className="btn-gold mt-7">Order fresh now <ChevronRight size={16} /></Link>
          </div>
          <div className="relative min-h-[280px] img-frame !rounded-none">
            <img src={IMG.heroAerial} alt="Aerial view of farmland delivery routes" loading="lazy" onError={imgFallback} className="absolute inset-0" />
            <div className="absolute bottom-4 left-4 right-4 card !rounded-2xl p-4 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-farm text-white grid place-items-center"><Truck size={19} /></span>
              <div className="text-sm"><b className="text-forest">Out for delivery</b><div className="text-muted text-xs">3 orders · Coimbatore route · ETA today 6 PM</div></div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* HOW */}
      <section id="how" className="max-w-7xl mx-auto px-4 pb-12">
        <motion.div {...fadeUp}>
          <span className="eyebrow">Simple by design</span>
          <h2 className="font-display font-black text-3xl text-forest mt-2">How it works</h2>
        </motion.div>
        <div className="grid md:grid-cols-4 gap-4 mt-5">
          {[['1', 'Farmers list produce', 'Price, quantity, harvest date and location.'],
            ['2', 'Buyers discover & order', 'Search, filter, cart and transparent checkout.'],
            ['3', 'Sellers accept & pack', 'Clear timeline: placed → accepted → ready.'],
            ['4', 'Doorstep delivery', 'Slots, run-sheets and live tracking.']].map(([n, h, p]) => (
            <motion.div key={n} {...fadeUp} className="card card-hover p-6 relative overflow-hidden">
              <div className="font-display font-black text-5xl text-farm/15 absolute top-3 right-4">{n}</div>
              <div className="font-bold text-lg mt-6">{h}</div><p className="text-sm text-muted mt-1">{p}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* BENEFITS */}
      <section className="max-w-7xl mx-auto px-4 pb-12 grid md:grid-cols-3 gap-4">
        {[
          [HandCoins, 'For farmers', 'Set your own price, manage stock, and reach buyers beyond the mandi.'],
          [Search, 'For buyers', 'Compare transparent farm-gate prices, check harvest dates, and order directly.'],
          [Truck, 'For everyone', 'Grouped delivery runs and clear fulfillment states keep logistics efficient.']
        ].map(([Icon, h, p]: any) => (
          <motion.div key={h as string} {...fadeUp} className="card card-hover p-6">
            <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-farm to-forest text-white grid place-items-center shadow-[0_6px_16px_rgba(40,120,74,.3)]"><Icon size={20} /></span>
            <h3 className="font-bold text-lg mt-4">{h}</h3><p className="text-muted text-sm mt-1 leading-relaxed">{p}</p>
          </motion.div>
        ))}
      </section>

      {/* FARMERS + TESTIMONIALS */}
      <section id="farmers" className="bg-forest text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(700px_340px_at_15%_0%,rgba(185,217,122,.18),transparent)]" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-4 py-14 grid lg:grid-cols-2 gap-10 items-center relative">
          <motion.div {...fadeUp}>
            <span className="badge bg-white/10 text-lime border border-white/15">For farmers & FPOs</span>
            <h2 className="font-display font-black text-3xl sm:text-4xl mt-3">Your harvest deserves a bigger market.</h2>
            <p className="text-white/70 mt-3 leading-relaxed">Onboard in minutes: create your farm profile, request verification, publish listings — and get orders with delivery slots attached.</p>
            <Link to="/register" className="btn-gold mt-6">Start selling today <ArrowRight size={16} /></Link>
          </motion.div>
          <div className="grid gap-3">
            {[
              ['Verified farms', 'Sellers complete farm profiles and admin verification before their listings go live.'],
              ['Transparent totals', 'Prices, quantities and delivery fees are recalculated on the server at checkout.'],
              ['Tracked delivery', 'Every order carries a slot, an ETA and a timestamped timeline you can follow.'],
            ].map(([h, p]) => (
              <div key={h} className="bg-white/[0.07] border border-white/10 rounded-2xl p-5 backdrop-blur">
                <div className="font-bold flex items-center gap-2"><ShieldCheck size={15} className="text-lime" /> {h}</div>
                <p className="text-sm text-white/65 mt-1.5 leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="max-w-4xl mx-auto px-4 py-14">
        <motion.div {...fadeUp} className="text-center">
          <span className="eyebrow">Good to know</span>
          <h2 className="font-display font-black text-3xl text-forest mt-2">Frequently asked questions</h2>
        </motion.div>
        <div className="mt-6 space-y-3">
          {[['Do I need to pay online?', 'No. Cash on Delivery works, plus a clearly-labelled simulated online option for classroom testing. No real payment is processed.'],
            ['How much is delivery?', 'Farm pickup is free. Home delivery is a flat ₹40 per seller order — and FREE when that order is ₹499 or more.'],
            ['Can I choose when it arrives?', 'Yes — pick a delivery slot at checkout (today evening, tomorrow morning/evening, and more).'],
            ['How do I track my order?', 'Open Orders → your order to see the live timeline with timestamps, ETA, slot and delivery notes.'],
            ['Is Tamil supported?', 'Key navigation and actions are translated. Switch language from the header.'],
            ['Can I review a product?', 'Yes, after your order is delivered or collected.']].map(([q, a]) => (
            <details key={q} className="card card-hover p-4 group"><summary className="font-semibold cursor-pointer list-none flex justify-between items-center">{q}<ChevronRight size={16} className="text-muted group-open:rotate-90 transition" /></summary><p className="text-sm text-muted mt-2 leading-relaxed">{a}</p></details>
          ))}
        </div>
      </section>
    </div>
  )
}
