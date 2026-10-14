import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { api } from '../lib/api'
import { Empty } from '../components/common/ui'

export default function Profile() {
  const { user } = useAuth()
  const { data: addrs } = useQuery({ queryKey: ['addrs'], queryFn: async () => (await api.get('/addresses')).data })
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display font-black text-3xl text-forest">Profile</h1>
      <div className="card p-5 mt-4 text-sm space-y-1">
        <div><b>Name:</b> {user?.full_name}</div>
        <div><b>Email:</b> {user?.email}</div>
        <div><b>Role:</b> {user?.role}</div>
      </div>
      <h2 className="font-bold mt-6">Addresses</h2>
      {(addrs || []).length === 0 && <div className="mt-2"><Empty title="No addresses" hint="Add one at checkout." /></div>}
      {(addrs || []).map((a: any) => (
        <div key={a.id} className="card p-4 mt-2 text-sm"><b>{a.recipient_name}</b> · {a.phone}<br />{a.address_line}, {a.city}, {a.state} {a.postal_code}</div>
      ))}
      <Link to="/market" className="btn-secondary mt-5 inline-block">Back to marketplace</Link>
    </div>
  )
}
