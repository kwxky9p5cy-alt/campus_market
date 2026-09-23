import { SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormField, Input, Select } from '@/components/ui/form-controls'
import { ProductGrid } from '@/components/product/product-grid'
import { CATEGORY_LABELS, CATEGORY_OPTIONS, CONDITION_LABELS, CONDITION_OPTIONS, PRODUCT_STATUS_LABELS } from '@/lib/constants'
import { marketplace } from '@/services/marketplace'
import { parseSearch } from '@/services/ai/searchParser'
import { safeErrorMessage } from '@/lib/utils'
import type { Product, ProductCategory, ProductCondition, ProductFilters, ProductStatus, SortOption } from '@/types/domain'

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const paramsKey = searchParams.toString()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const smartParam = searchParams.get('smart')

  const filters = useMemo<ProductFilters>(() => {
    const params = new URLSearchParams(paramsKey)
    return {
      query: params.get('q') ?? undefined,
      category: (params.get('category') as ProductCategory | null) ?? 'all',
      minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : null,
      maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : null,
      condition: (params.get('condition') as ProductCondition | null) ?? 'all',
      status: (params.get('status') as ProductStatus | null) ?? 'all',
      sort: (params.get('sort') as SortOption | null) ?? 'newest',
    }
  }, [paramsKey])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setProducts(await marketplace.listProducts(filters)) }
    catch (loadError) { setError(safeErrorMessage(loadError)) }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const smart = smartParam
    if (!smart) return
    let active = true
    setAiLoading(true)
    void parseSearch({ text: smart }).then((result) => {
      if (!active) return
      const next = new URLSearchParams(paramsKey)
      next.delete('smart')
      if (result.keywords.length) next.set('q', result.keywords.join(' '))
      if (result.category) next.set('category', result.category)
      if (result.priceMin != null) next.set('minPrice', String(result.priceMin))
      if (result.priceMax != null) next.set('maxPrice', String(result.priceMax))
      if (result.condition) next.set('condition', result.condition)
      setSearchParams(next, { replace: true })
    }).catch((parseError) => setError(safeErrorMessage(parseError, '智能检索暂时不可用，请使用普通筛选。'))).finally(() => setAiLoading(false))
    return () => { active = false }
  }, [paramsKey, setSearchParams, smartParam])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const next = new URLSearchParams()
    for (const key of ['q', 'category', 'minPrice', 'maxPrice', 'condition', 'status', 'sort']) {
      const value = String(form.get(key) ?? '').trim()
      if (value && value !== 'all' && value !== 'newest') next.set(key, value)
    }
    setSearchParams(next)
    setFilterOpen(false)
  }

  async function smartSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const smart = String(new FormData(event.currentTarget).get('smart') ?? '').trim()
    if (smart) setSearchParams({ smart })
  }

  const chips = [
    filters.query ? { key: 'q', label: filters.query } : null,
    filters.category && filters.category !== 'all' ? { key: 'category', label: CATEGORY_LABELS[filters.category] } : null,
    filters.minPrice != null ? { key: 'minPrice', label: `≥ ¥${filters.minPrice}` } : null,
    filters.maxPrice != null ? { key: 'maxPrice', label: `≤ ¥${filters.maxPrice}` } : null,
    filters.condition && filters.condition !== 'all' ? { key: 'condition', label: CONDITION_LABELS[filters.condition] } : null,
    filters.status && filters.status !== 'all' ? { key: 'status', label: PRODUCT_STATUS_LABELS[filters.status] } : null,
  ].filter(Boolean) as Array<{ key: string; label: string }>

  function removeChip(key: string) {
    const next = new URLSearchParams(searchParams)
    next.delete(key)
    setSearchParams(next)
  }

  return (
    <div className="page-container py-5 sm:py-7">
      <div className="flex items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">浏览商品</h1><p className="mt-1 text-sm text-muted-foreground">{loading ? '正在查找…' : `找到 ${products.length} 件商品`}</p></div><Button variant="outline" className="lg:hidden" onClick={() => setFilterOpen((open) => !open)}><SlidersHorizontal className="h-4 w-4" />筛选</Button></div>
      <form className="mt-5 flex flex-col gap-2 border-y border-border bg-muted/35 p-3 sm:flex-row" onSubmit={smartSearch}>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1"><Sparkles className="h-4 w-4 shrink-0 text-primary" /><Input name="smart" className="border-0 bg-transparent shadow-none focus-visible:ring-0" placeholder="智能检索：300 元以内、成色较好的机械键盘" aria-label="自然语言智能检索" /></div>
        <Button type="submit" variant="secondary" loading={aiLoading}>理解并查找</Button>
      </form>
      {chips.length ? <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">当前条件</span>{chips.map((chip) => <Badge key={chip.key} className="gap-1 bg-card">{chip.label}<button type="button" onClick={() => removeChip(chip.key)} className="focus-ring rounded" aria-label={`移除条件 ${chip.label}`}><X className="h-3 w-3" /></button></Badge>)}<button type="button" className="focus-ring rounded text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => setSearchParams({})}>清除全部</button></div> : null}
      <div className="mt-6 grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className={filterOpen ? 'block' : 'hidden lg:block'}>
          <form key={paramsKey} onSubmit={applyFilters} className="grid gap-4 lg:sticky lg:top-24">
            <FormField label="关键词" htmlFor="filter-q"><Input id="filter-q" name="q" defaultValue={filters.query} placeholder="标题、描述或分类" /></FormField>
            <FormField label="分类" htmlFor="filter-category"><Select id="filter-category" name="category" defaultValue={filters.category}>{CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></FormField>
            <div className="grid grid-cols-2 gap-2"><FormField label="最低价" htmlFor="filter-min"><Input id="filter-min" name="minPrice" type="number" min="0" step="0.01" defaultValue={filters.minPrice ?? ''} placeholder="¥ 0" /></FormField><FormField label="最高价" htmlFor="filter-max"><Input id="filter-max" name="maxPrice" type="number" min="0" step="0.01" defaultValue={filters.maxPrice ?? ''} placeholder="不限" /></FormField></div>
            <FormField label="成色" htmlFor="filter-condition"><Select id="filter-condition" name="condition" defaultValue={filters.condition}>{CONDITION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></FormField>
            <FormField label="状态" htmlFor="filter-status"><Select id="filter-status" name="status" defaultValue={filters.status}><option value="all">全部状态</option><option value="active">在售</option><option value="reserved">已预订</option></Select></FormField>
            <FormField label="排序" htmlFor="filter-sort"><Select id="filter-sort" name="sort" defaultValue={filters.sort}><option value="newest">最新发布</option><option value="price_asc">价格从低到高</option><option value="price_desc">价格从高到低</option></Select></FormField>
            <Button type="submit">应用筛选</Button>
          </form>
        </aside>
        <section aria-live="polite"><ProductGrid products={products} loading={loading || aiLoading} error={error} onRetry={load} emptyTitle="没有找到匹配商品" emptyDescription="试试减少条件、提高预算，或换一个关键词。" /></section>
      </div>
    </div>
  )
}
