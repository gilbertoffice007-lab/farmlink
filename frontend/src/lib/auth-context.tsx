import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from './api'

export type Role = 'buyer' | 'seller' | 'admin'
export interface User { id: number; full_name: string; email: string; role: Role; phone?: string | null }

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  login: (token: string, user: User) => void
  logout: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthState>({ user: null, token: null, loading: true, login: () => {}, logout: () => {}, refresh: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('farmlink_token'))
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const t = localStorage.getItem('farmlink_token')
    if (!t) { setLoading(false); return }
    try {
      const { data } = await api.get('/auth/me')
      setUser(data); setToken(t)
    } catch {
      localStorage.removeItem('farmlink_token')
      setUser(null); setToken(null)
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const login = (tok: string, u: User) => {
    // Dev note: bearer token in localStorage for this academic build.
    // Production should prefer HttpOnly cookies; see docs/deployment.md.
    localStorage.setItem('farmlink_token', tok)
    setToken(tok); setUser(u)
  }
  const logout = () => {
    api.post('/auth/logout').catch(() => {})
    localStorage.removeItem('farmlink_token')
    setUser(null); setToken(null)
  }
  return <Ctx.Provider value={{ user, token, loading, login, logout, refresh }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
