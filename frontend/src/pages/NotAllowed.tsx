import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../lib/auth-context'

/** Shown when a signed-in role opens a page meant for another role
 * (buyers can't sell, sellers can't shop — enforced by the backend too). */
export default function NotAllowed() {
  const { user } = useAuth()
  const home = user?.role === 'seller' ? '/seller' : user?.role === 'admin' ? '/admin' : '/buyer'
  const homeLabel = user?.role === 'seller' ? 'Seller workspace' : user?.role === 'admin' ? 'Admin console' : 'Buyer dashboard'
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <ShieldAlert size={44} className="mx-auto text-amber-500" />
      <h1 className="font-display font-black text-2xl text-forest mt-4">Wrong counter, {user?.full_name.split(' ')[0] || 'friend'}</h1>
      <p className="text-muted text-sm mt-2 leading-relaxed">
        {user?.role === 'seller'
          ? 'Seller accounts are for selling — listings, orders and delivery. Shopping needs a buyer account.'
          : 'Buyer accounts are for shopping. Selling needs a seller account.'}
        <br />Everyone sticks to their own counter here.
      </p>
      <div className="flex gap-2 justify-center mt-6">
        <Link to={home} className="btn-primary">{homeLabel}</Link>
        <Link to="/market" className="btn-secondary">Browse market</Link>
      </div>
    </div>
  )
}
