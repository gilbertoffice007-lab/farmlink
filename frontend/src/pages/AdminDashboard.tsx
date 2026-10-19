import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { api, apiError } from '../lib/api'
import { queryClient } from '../lib/query-client'
import { StatusBadge } from '../components/common/ui'

export default function AdminDashboard() {
  const [tab, setTab] = useState<'overview' | 'users' | 'sellers' | 'products' | 'orders' | 'audit'>('overview')
  const dash = useQuery({ queryKey: ['admin-dash'], queryFn: async () => (await api.get('/dashboard/admin')).data })
  const users = useQuery({ queryKey: ['a-users'], queryFn: async () => (await api.get('/admin/users')).data, enabled: tab === 'users' })
  const pending = useQuery({ queryKey: ['a-pending'], queryFn: async () => (await api.get('/admin/sellers/pending')).data, enabled: tab === 'sellers' })
  const aprods = useQuery({ queryKey: ['a-prods'], queryFn: async () => (await api.get('/admin/products')).data, enabled: tab === 'products' })
  const aorders = useQuery({ queryKey: ['a-orders'], queryFn: async () => (await api.get('/admin/orders')).data, enabled: tab === 'orders' })
  const audit = useQuery({ queryKey: ['a-audit'], queryFn: async () => (await api.get('/admin/audit-logs')).data, enabled: tab === 'audit' })
  const analytics = useQuery({ queryKey: ['a-analytics'], queryFn: async () => (await api.get('/analytics/admin')).data, enabled: tab === 'overview' })

  const act = useMutation({
    mutationFn: ({ url, body }: any) => api.post(url, body || {}).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries(); toast.success('Done') },
    onError: (e: any) => toast.error(apiError(e))
  })
  const patch = useMutation({
    mutationFn: ({ url, body }: any) => api.patch(url, body).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries(); toast.success('Updated') },
    onError: (e: any) => toast.error(apiError(e))
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display font-black text-3xl text-forest">Admin console</h1>
      <p className="text-sm text-muted">Every sensitive action is written to the audit log.</p>
      <div className="flex gap-2 mt-4 flex-wrap" role="tablist" aria-label="Admin sections">
        {(['overview', 'users', 'sellers', 'products', 'orders', 'audit'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize ${tab === t ? 'bg-forest text-white' : 'bg-white border border-line'}`}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mt-5">
            {[['Users', dash.data?.total_users], ['Sellers', dash.data?.total_sellers], ['Active listings', dash.data?.active_listings],
              ['Orders', dash.data?.total_orders], ['Sales vol.', dash.data ? `₹${Number(dash.data.sales_volume).toFixed(0)}` : '…']].map(([l, v]) => (
              <div key={l as string} className="card p-4"><div className="text-xs text-muted">{l}</div><div className="text-xl font-extrabold">{v ?? '…'}</div></div>
            ))}
          </div>
          <div className="card p-5 mt-4">
            <h2 className="font-bold">Platform sales trend</h2>
            <div className="h-60 mt-2">
              <ResponsiveContainer><LineChart data={analytics.data?.sales_by_day || []}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                <Line type="monotone" dataKey="total" stroke="#28784A" strokeWidth={2} dot={false} />
              </LineChart></ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {tab === 'users' && (
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="text-left text-muted border-b border-line"><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Active</th><th className="p-3">Action</th></tr></thead>
            <tbody>{(users.data || []).map((u: any) => (
              <tr key={u.id} className="border-b border-line last:border-0"><td className="p-3 font-semibold">{u.full_name}</td>
                <td className="p-3">{u.email}</td><td className="p-3">{u.role}</td><td className="p-3">{String(u.is_active)}</td>
                <td className="p-3"><button onClick={() => patch.mutate({ url: `/admin/users/${u.id}/status`, body: { is_active: !u.is_active } })}
                  className="btn-secondary !px-3 !py-1 text-xs">{u.is_active ? 'Suspend' : 'Activate'}</button></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === 'sellers' && (
        <div className="space-y-2 mt-5">
          {(pending.data || []).length === 0 && <p className="text-sm text-muted">No pending verifications.</p>}
          {(pending.data || []).map((s: any) => (
            <div key={s.profile_id} className="card p-4 flex flex-wrap items-center gap-2 text-sm">
              <div className="flex-1 min-w-44"><b>{s.farm_name}</b> — {s.name} · {s.city}, {s.state} <StatusBadge status={s.status} /></div>
              <button onClick={() => act.mutate({ url: `/admin/sellers/${s.user_id}/approve` })} className="btn-primary !px-3 !py-1.5 text-sm">Approve</button>
              <button onClick={() => act.mutate({ url: `/admin/sellers/${s.user_id}/reject` })} className="btn-secondary !px-3 !py-1.5 text-sm">Reject</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-2 mt-5">
          {(aprods.data || []).map((p: any) => (
            <div key={p.id} className="card p-4 flex flex-wrap items-center gap-2 text-sm">
              <div className="flex-1 min-w-44"><b>{p.name}</b> · {p.seller} · ₹{p.price} <StatusBadge status={p.status} /></div>
              {['active', 'suspended', 'inactive'].map((s) => (
                <button key={s} onClick={() => patch.mutate({ url: `/admin/products/${p.id}/moderation`, body: { status: s } })}
                  className="btn-secondary !px-2.5 !py-1 text-xs capitalize">{s}</button>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-2 mt-5">
          {(aorders.data || []).slice(0, 100).map((o: any) => (
            <div key={o.id} className="card p-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-1"><b>{o.order_number}</b><StatusBadge status={o.status} /><span>₹{o.total_amount}</span><span className="text-muted">buyer {o.buyer_id} → seller {o.seller_id}</span></div>
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-2 mt-5">
          {(audit.data || []).map((l: any) => (
            <div key={l.id} className="card p-3 text-sm"><b>{l.action}</b> · {l.entity} {l.entity_id} · by {l.actor} <span className="text-muted">{l.details} · {new Date(l.created_at).toLocaleString()}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}
