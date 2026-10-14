import { useEffect, useState } from 'react'
export function useDebounce<T>(v: T, ms = 400): T {
  const [s, setS] = useState(v)
  useEffect(() => { const id = setTimeout(() => setS(v), ms); return () => clearTimeout(id) }, [v, ms])
  return s
}
