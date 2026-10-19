import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Empty, ErrorBox, StatusBadge } from '../components/common/ui'

export default function Orders() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['orders'], queryFn: async () => (await api.get('/orders')).data })
  if (isLoading) return <div className="max-w-4xl mx-auto p-4"><div className="skeleton h-64" /></div>
  if (isError) return <div className="max-w-4xl mx-auto p-4"><ErrorBox message="Could not load orders." onRetry={() => refetch()} /></div>
  if (!data?.length) return <div className="max-w-2xl mx-auto p-4 py-10"><Empty title="No orders yet" action={<Link to="/market" className="btn-primary">Start shopping</Link>} /></div>
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display font-black text-3xl text-forest">Orders</h1>
      <div className="space-y-3 mt-4">
        {data.map((o: any) => (
          <Link key={o.id} to={`/orders/${o.id}`} className="card p-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 hover:shadow-lg transition">
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{o.order_number}</div>
              <div className="text-sm text-muted truncate">{new Date(o.created_at).toLocaleDateString()} · {o.items?.length || ''} items · {o.seller_name || ''}</div>
            </div>
            <StatusBadge status={o.status} />
            <div className="font-extrabold ml-auto sm:ml-0">₹{Number(o.total_amount).toFixed(2)}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
