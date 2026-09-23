import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/components/ui/toast'
import { marketplace } from '@/services/marketplace'
import { safeErrorMessage } from '@/lib/utils'

interface FavoritesContextValue {
  ids: Set<string>
  loading: boolean
  toggle: (productId: string) => Promise<void>
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { session, requireAuth } = useAuth()
  const { toast } = useToast()
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!session) { setIds(new Set()); return }
    try { setIds(new Set(await marketplace.favoriteIds())) } catch { setIds(new Set()) }
  }, [session])

  useEffect(() => {
    void load()
    return marketplace.subscribe(() => { void load() })
  }, [load])

  const toggle = useCallback(async (productId: string) => {
    if (!requireAuth()) return
    const wasFavorite = ids.has(productId)
    setIds((current) => {
      const next = new Set(current)
      if (wasFavorite) next.delete(productId)
      else next.add(productId)
      return next
    })
    setLoading(true)
    try {
      const isFavorite = await marketplace.toggleFavorite(productId)
      setIds((current) => {
        const next = new Set(current)
        if (isFavorite) next.add(productId)
        else next.delete(productId)
        return next
      })
      toast({ title: isFavorite ? '已加入收藏' : '已取消收藏', tone: 'success' })
    } catch (error) {
      setIds((current) => {
        const next = new Set(current)
        if (wasFavorite) next.add(productId)
        else next.delete(productId)
        return next
      })
      toast({ title: '收藏状态未保存', description: safeErrorMessage(error), tone: 'error' })
    } finally { setLoading(false) }
  }, [ids, requireAuth, toast])

  const value = useMemo(() => ({ ids, loading, toggle }), [ids, loading, toggle])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const value = useContext(FavoritesContext)
  if (!value) throw new Error('useFavorites must be used inside FavoritesProvider')
  return value
}
