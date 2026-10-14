import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, Role } from '../../lib/auth-context'

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="max-w-7xl mx-auto p-8">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/not-allowed" replace />
  return <Outlet />
}
