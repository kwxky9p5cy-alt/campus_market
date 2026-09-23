import { Heart } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProductGrid } from '@/components/product/product-grid'
import { marketplace } from '@/services/marketplace'
import { safeErrorMessage } from '@/lib/utils'
import type { Product } from '@/types/domain'

export function FavoritesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setProducts(await marketplace.listFavorites()) }
    catch (loadError) { setError(safeErrorMessage(loadError)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(); return marketplace.subscribe(() => { void load() }) }, [load])
  return <div className="page-container py-5 sm:py-7"><div className="border-b border-border pb-5"><div className="flex items-center gap-2"><Heart className="h-5 w-5" /><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">我的收藏</h1></div><p className="mt-1 text-sm text-muted-foreground">{loading ? '正在加载…' : `${products.length} 件商品`}</p></div><div className="mt-6"><ProductGrid products={products} loading={loading} error={error} onRetry={load} emptyTitle="还没有收藏" emptyDescription="浏览商品时点击心形按钮，想看的商品会保存在这里。" emptyActionLabel="去浏览商品" onEmptyAction={() => navigate('/search')} /></div></div>
}
