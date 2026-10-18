import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Empty } from '../components/common/ui'

export default function Notifications() {
  const { data } = useQuery({ queryKey: ['notifs'], queryFn: async () => (await api.get('/notifications')).data })
  const mark = async (id: number) => { await api.patch(`/notifications/${id}/read`); location.reload() }
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display font-black text-3xl text-forest">Notifications</h1>
      {(!data || data.length === 0) && <div className="mt-4"><Empty title="No notifications" action={<Link to="/market" className="btn-primary">Explore produce</Link>} /></div>}
      {(Array.isArray(data) ? data : []).map((n: any) => (
        <div key={n.id} className={`card p-4 mt-2 text-sm ${n.read_at ? 'opacity-70' : ''}`}>
          <b>{n.title}</b><p className="text-muted">{n.message}</p>
          {!n.read_at && <button onClick={() => mark(n.id)} className="text-farm font-semibold text-xs mt-1">Mark as read</button>}
        </div>
      ))}
    </div>
  )
}
