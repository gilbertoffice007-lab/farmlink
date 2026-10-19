import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../lib/api'
import { ErrorBox } from '../components/common/ui'

export default function Insights() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['demand'], queryFn: async () => (await api.get('/analytics/demand')).data
  })
  if (isLoading) return <div className="max-w-6xl mx-auto p-4"><div className="skeleton h-64" /></div>
  if (isError) return <div className="max-w-4xl mx-auto p-4"><ErrorBox message="Could not load insights." onRetry={() => refetch()} /></div>
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display font-black text-3xl text-forest">Demand insights</h1>
      <p className="text-sm text-muted mt-1">{data.note} Transparent totals — no ML forecasting claimed.</p>
      {data.limited_data && <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 mt-3">Based on limited data — insights will improve as more orders arrive.</p>}
      <div className="grid lg:grid-cols-2 gap-4 mt-5">
        <div className="card p-5">
          <h2 className="font-bold">Most ordered products</h2>
          <div className="h-64 mt-2">
            <ResponsiveContainer><BarChart data={(data.top_products || []).slice(0, 8)} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} /><Tooltip />
              <Bar dataKey="qty" fill="#28784A" radius={[0, 6, 6, 0]} />
            </BarChart></ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-bold">Category demand</h2>
          <div className="h-64 mt-2">
            <ResponsiveContainer><BarChart data={data.category_demand || []}>
              <XAxis dataKey="category" tick={{ fontSize: 10 }} interval={0} angle={-15} height={60} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
              <Bar dataKey="qty" fill="#75A85B" radius={[6, 6, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="card p-5 mt-4">
        <h2 className="font-bold">Restock suggestions</h2>
        {(data.restock_suggestions || []).length === 0 && <p className="text-sm text-muted mt-1">Stock looks healthy against current demand.</p>}
        {(data.restock_suggestions || []).map((s: any) => (
          <div key={s.product} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-sm py-2 border-b border-line last:border-0">
            <span><b>{s.product}</b> — {s.stock} left, {s.ordered_qty} ordered</span><span className="text-farm font-semibold">{s.advice}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
