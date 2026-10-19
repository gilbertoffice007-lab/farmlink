import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Leaf, ShoppingBasket, Bell, LogOut, LayoutDashboard, ShieldCheck, Menu, X, Truck, User as UserIcon } from 'lucide-react'
import { useAuth } from '../../lib/auth-context'
import { useLang } from '../../lib/i18n'
import { api } from '../../lib/api'

export function Navbar() {
  const { user, logout } = useAuth()
  const { t, lang, setLang } = useLang()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const { data: cart } = useQuery({
    queryKey: ['cart-count'], queryFn: async () => (await api.get('/cart')).data,
    enabled: user?.role === 'buyer', staleTime: 15_000, retry: false
  })
  const count = cart?.items?.length || 0

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-line/80 shadow-[0_2px_20px_rgba(22,61,43,.05)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-2 sm:gap-3">
          <button className="md:hidden p-2 -ml-2 rounded-lg hover:bg-cream shrink-0" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <Link to="/" className="flex items-center gap-2 font-extrabold text-forest text-lg min-w-0" aria-label="FarmLink home">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-farm to-forest text-white grid place-items-center shadow-[0_6px_16px_rgba(40,120,74,.35)] shrink-0"><Leaf size={20} /></span>
            <span className="font-display text-[18px] sm:text-[22px] tracking-tight whitespace-nowrap">FarmLink</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[15px] font-medium ml-5" aria-label="Primary">
            <Link className="hover:text-farm transition" to="/market">{t('nav.explore')}</Link>
            <a className="hover:text-farm transition" href="/#how">How It Works</a>
            <a className="hover:text-farm transition" href="/#farmers">For Farmers</a>
            {user && <Link className="hover:text-farm transition inline-flex items-center gap-1" to="/orders"><Truck size={15} /> Track order</Link>}
          </nav>
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5 shrink-0">
            <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value as any)}
              className="hidden sm:block border border-line rounded-lg px-2 py-1.5 text-sm bg-white font-medium">
              <option value="en">English</option>
              <option value="ta">தமிழ்</option>
            </select>
            {user ? (
              <>
                {user.role === 'buyer' && (
                  <Link to="/cart" aria-label={`Cart, ${count} items`} className="relative p-2 rounded-xl hover:bg-cream transition hidden sm:block">
                    <ShoppingBasket size={20} />
                    {count > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-farm text-white text-[11px] font-bold grid place-items-center">{count}</span>}
                  </Link>
                )}
                <Link to="/notifications" aria-label="Notifications" className="relative p-2 rounded-xl hover:bg-cream transition"><Bell size={20} /></Link>
                <Link to={user.role === 'seller' ? '/seller' : user.role === 'admin' ? '/admin' : '/buyer'}
                  aria-label={t('nav.dashboard')} title={t('nav.dashboard')}
                  className="p-2 rounded-xl hover:bg-cream transition text-forest">
                  {user.role === 'admin' ? <ShieldCheck size={20} /> : <LayoutDashboard size={20} />}
                </Link>
                <button onClick={() => { logout(); nav('/') }} className="p-2 rounded-xl hover:bg-cream transition hidden sm:block" aria-label="Log out"><LogOut size={18} /></button>
              </>
            ) : (
              <>
                <Link to="/login" className="hidden sm:inline-flex text-sm font-semibold px-3 py-2 hover:text-farm transition whitespace-nowrap items-center">{t('nav.login')}</Link>
                <Link to="/register" className="hidden sm:inline-flex btn-primary !px-4 !py-2 text-sm whitespace-nowrap">{t('nav.register')}</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-pine/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-lift p-5">
            <div className="flex justify-between items-center mb-5">
              <span className="font-display font-bold text-lg text-forest">FarmLink</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-2 rounded-lg hover:bg-cream"><X size={18} /></button>
            </div>
            {!user && (
              <div className="flex gap-2 mb-4">
                <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary flex-1 !py-2.5 text-sm justify-center">{t('nav.login')}</Link>
                <Link to="/register" onClick={() => setOpen(false)} className="btn-primary flex-1 !py-2.5 text-sm justify-center">{t('nav.register')}</Link>
              </div>
            )}
            <nav className="space-y-1 font-semibold" aria-label="Mobile">
              {[['/', 'Home'], ['/market', t('nav.explore')], ['/#how', 'How It Works'], ['/#farmers', 'For Farmers']].map(([to, label]) => (
                <Link key={to + label} to={to} onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-xl hover:bg-cream">{label}</Link>
              ))}
            </nav>
            {user && (
              <nav className="mt-4 pt-4 border-t border-line space-y-1 font-semibold" aria-label="Account">
                <Link to={user.role === 'seller' ? '/seller' : user.role === 'admin' ? '/admin' : '/buyer'} onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-xl hover:bg-cream">{t('nav.dashboard')}</Link>
                {user.role === 'buyer' && (
                  <Link to="/cart" onClick={() => setOpen(false)} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-cream">
                    <span>{t('nav.cart')}</span>
                    {count > 0 && <span className="badge bg-farm text-white !text-[11px]">{count}</span>}
                  </Link>
                )}
                <Link to="/orders" onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-xl hover:bg-cream">{t('nav.orders')}</Link>
                <Link to="/notifications" onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-xl hover:bg-cream">{t('nav.notifications')}</Link>
                <Link to="/profile" onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-xl hover:bg-cream">Profile</Link>
                {(user.role === 'seller' || user.role === 'admin') && (
                  <Link to="/logistics" onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-xl hover:bg-cream">Logistics</Link>
                )}
                <button onClick={() => { logout(); setOpen(false); nav('/') }} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-cream text-red-600">{t('nav.logout')}</button>
              </nav>
            )}
            <div className="mt-4 pt-4 border-t border-line">
              <label className="block text-xs font-bold uppercase tracking-wide text-muted px-3 mb-2" htmlFor="drawer-lang">Language</label>
              <select id="drawer-lang" aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value as any)}
                className="w-full border border-line rounded-xl px-3 py-2.5 text-sm bg-white font-medium">
                <option value="en">English</option>
                <option value="ta">தமிழ்</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function Footer() {
  return (
    <footer className="bg-pine text-white/85 mt-16 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-farm/25 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-lime/10 blur-3xl" aria-hidden="true" />
      <div className="max-w-7xl mx-auto px-4 py-14 grid gap-10 md:grid-cols-4 relative">
        <div>
          <div className="font-display font-bold text-2xl flex items-center gap-2 text-white"><Leaf size={22} className="text-lime" /> FarmLink</div>
          <p className="text-sm text-white/65 mt-3 leading-relaxed">Direct trade between farmers, FPOs and buyers — transparent prices, fresher produce, fewer unnecessary intermediaries.</p>
          <div className="flex gap-2 mt-4 text-[11px] font-bold">
            <span className="badge bg-white/10 text-lime">COD available</span>
            <span className="badge bg-white/10 text-lime">Free ₹499+</span>
          </div>
        </div>
        <div>
          <div className="font-bold mb-3 text-white">Marketplace</div>
          <ul className="text-sm space-y-2 text-white/70">
            <li><Link to="/market" className="hover:text-lime transition">Explore Produce</Link></li>
            <li><Link to="/register" className="hover:text-lime transition">Sell Your Produce</Link></li>
            <li><Link to="/orders" className="hover:text-lime transition">Track Orders</Link></li>
            <li><Link to="/insights" className="hover:text-lime transition">Demand Insights</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-bold mb-3 text-white">Company</div>
          <ul className="text-sm space-y-2 text-white/70">
            <li><a href="/#how" className="hover:text-lime transition">How It Works</a></li>
            <li><a href="/#farmers" className="hover:text-lime transition">For Farmers</a></li>
            <li><a href="/#faq" className="hover:text-lime transition">FAQ</a></li>
            <li><Link to="/login" className="hover:text-lime transition">Sign in</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-bold mb-3 text-white">Contact (demo)</div>
          <p className="text-sm text-white/70">hello@farmlink.example.com<br />Chennai, Tamil Nadu</p>
          <p className="text-xs text-white/45 mt-3">Privacy · Terms (academic demo)</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50 relative">© 2026 FarmLink · UI/UX academic project · Live marketplace data</div>
    </footer>
  )
}
