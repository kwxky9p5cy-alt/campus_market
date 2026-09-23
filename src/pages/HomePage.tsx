import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'
import { ProductGrid } from '@/components/product/product-grid'
import { CATEGORY_OPTIONS } from '@/lib/constants'
import { marketplace } from '@/services/marketplace'
import { safeErrorMessage } from '@/lib/utils'
import type { Product } from '@/types/domain'

export function HomePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await marketplace.listProducts({ sort: 'newest' })
      setProducts(data.filter((item) => ['active', 'reserved'].includes(item.status)).slice(0, 15))
    } catch (loadError) { setError(safeErrorMessage(loadError)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(); return marketplace.subscribe(() => { void load() }) }, [load])

  return (
    <div className="page-container py-5 sm:py-7">
      <section aria-labelledby="browse-title">
        <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 id="browse-title" className="text-xl font-semibold tracking-tight sm:text-2xl">最近发布</h1><p className="mt-1 text-sm text-muted-foreground">找到附近同学正在转让的好物</p></div>
          <Button asChild variant="outline" size="sm"><Link to="/search">查看全部 <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="商品分类">
          {CATEGORY_OPTIONS.map((category) => <Link key={category.value} to={category.value === 'all' ? '/search' : `/search?category=${category.value}`} className="focus-ring shrink-0 rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-foreground/25 hover:bg-muted">{category.label}</Link>)}
        </div>
        <div className="mt-6"><ProductGrid products={products} loading={loading} error={error} onRetry={load} /></div>
      </section>
      <section className="mt-12 border-y border-border bg-muted/35 px-4 py-6 sm:flex sm:items-center sm:justify-between sm:px-6" aria-labelledby="smart-search-title">
        <div><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h2 id="smart-search-title" className="text-sm font-semibold">说说你想找什么</h2></div><p className="mt-1 text-sm text-muted-foreground">例如“300 元以内、成色较好的机械键盘”</p></div>
        <form className="mt-4 flex gap-2 sm:mt-0 sm:w-[430px]" onSubmit={(event) => { event.preventDefault(); const text = new FormData(event.currentTarget).get('smart')?.toString().trim(); if (text) navigate(`/search?smart=${encodeURIComponent(text)}`) }}>
          <Input name="smart" aria-label="智能检索描述" placeholder="描述预算、品类和成色" />
          <Button type="submit" variant="secondary"><Search className="h-4 w-4" />查找</Button>
        </form>
      </section>
    </div>
  )
}
