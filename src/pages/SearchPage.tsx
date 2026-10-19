import { RotateCcw, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormField, Input, Select } from '@/components/ui/form-controls'
import { ProductGrid } from '@/components/product/product-grid'
import { CAMPUS_OPTIONS, splitCampusAddress, type CampusName, resolveCampusLocation, removeCampusLocationTerms } from '@/services/campus-locations'
import { formatDistance, geocodeCampusLocation, resetAMapLoader, walkingDistanceMeters } from '@/services/amap-distance'
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
  const [distanceLoading, setDistanceLoading] = useState(false)
  const [distanceError, setDistanceError] = useState('')
  const [distances, setDistances] = useState<Record<string, { meters?: number; differentCampus?: boolean; unavailable?: boolean }>>({})
  const [distanceAttempt, setDistanceAttempt] = useState(0)
  const [filterOpen, setFilterOpen] = useState(false)
  const smartParam = searchParams.get('smart')
  const origin = searchParams.get('origin') ?? ''
  const originCampus = (searchParams.get('originCampus') ?? CAMPUS_OPTIONS[0]) as CampusName
  const maxDistance = searchParams.get('maxDistance') ? Number(searchParams.get('maxDistance')) : null

  const filters = useMemo<ProductFilters>(() => {
    const params = new URLSearchParams(paramsKey)
    return {
      query: params.get('q') ?? undefined,
      location: params.get('location') ?? undefined,
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
    if (!origin.trim()) {
      setDistances({})
      setDistanceError('')
      setDistanceLoading(false)
      return
    }
    if (loading) {
      setDistanceLoading(false)
      setDistances({})
      return
    }
    if (!products.length) {
      setDistanceLoading(false)
      setDistances({})
      return
    }
    let active = true
    setDistanceLoading(true)
    setDistanceError('')
    setDistances({})
    void (async () => {
      const start = await geocodeCampusLocation(originCampus, origin)
      if (!start) throw new Error('没有识别到买家起点，请输入地图上可搜索的校内地点。')
      const next: typeof distances = {}
      let index = 0
      const worker = async () => {
        while (index < products.length) {
          const product = products[index++]
          const destination = splitCampusAddress(product.location)
          if (destination.campus !== originCampus) {
            next[product.id] = { differentCampus: true }
            continue
          }
          try {
            const point = await geocodeCampusLocation(destination.campus, destination.location)
            const meters = point ? await walkingDistanceMeters(start, point) : null
            next[product.id] = meters == null ? { unavailable: true } : { meters }
          } catch {
            next[product.id] = { unavailable: true }
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(3, products.length) }, () => worker()))
      if (active) {
        setDistances(next)
        const comparable = Object.values(next).filter((distance) => !distance.differentCampus)
        if (comparable.length && comparable.every((distance) => distance.unavailable)) {
          setDistanceError('暂时无法取得步行路线，距离范围尚未应用。当前显示其他条件的搜索结果。')
        }
      }
    })().catch((distanceFailure: unknown) => {
      if (active) {
        setDistances({})
        setDistanceError(safeErrorMessage(distanceFailure, '距离计算暂时不可用，当前显示其他条件的搜索结果。'))
      }
    }).finally(() => { if (active) setDistanceLoading(false) })
    return () => { active = false }
  }, [distanceAttempt, loading, origin, originCampus, products])

  function retryDistance() {
    resetAMapLoader()
    setDistanceAttempt((attempt) => attempt + 1)
  }

  const visibleProducts = useMemo(() => products.flatMap((product) => {
    const distance = distances[product.id]
    if (maxDistance != null && distance?.meters != null && distance.meters > maxDistance) return []
    return [{
      ...product,
      distanceLabel: distance?.meters == null ? undefined : formatDistance(distance.meters),
      differentCampus: distance?.differentCampus,
      distanceUnavailable: distance?.unavailable,
    }]
  }), [products, distances, maxDistance])

  useEffect(() => {
    const smart = smartParam
    if (!smart) return
    let active = true
    setAiLoading(true)
    const campusLocation = resolveCampusLocation(smart)
    const searchableText = removeCampusLocationTerms(smart)
    void parseSearch({ text: searchableText }).then((result) => {
      if (!active) return
      const next = new URLSearchParams(paramsKey)
      next.delete('smart')
      if (result.keywords.length) next.set('q', result.keywords.join(' '))
      else next.delete('q')
      if (campusLocation) next.set('location', campusLocation.canonical)
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
    for (const key of ['q', 'location', 'origin', 'originCampus', 'maxDistance', 'category', 'minPrice', 'maxPrice', 'condition', 'status', 'sort']) {
      const value = String(form.get(key) ?? '').trim()
      if (value && value !== 'all' && value !== 'newest') {
        const campusLocation = key === 'location' || key === 'origin' ? resolveCampusLocation(value) : null
        next.set(key, campusLocation?.canonical ?? value)
      }
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
    filters.location ? { key: 'location', label: `交易地点：${filters.location}` } : null,
    origin ? { key: 'origin', label: `起点：${origin}（${originCampus}）` } : null,
    maxDistance != null ? { key: 'maxDistance', label: `范围：${maxDistance < 1000 ? `${maxDistance}m` : `${maxDistance / 1000}km`}` } : null,
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
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1"><Sparkles className="h-4 w-4 shrink-0 text-primary" /><Input name="smart" className="border-0 bg-transparent shadow-none focus-visible:ring-0" placeholder="智能检索：一组团附近的 300 元以内机械键盘" aria-label="自然语言智能检索" /></div>
        <Button type="submit" variant="secondary" loading={aiLoading}>理解并查找</Button>
      </form>
      {chips.length ? <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">当前条件</span>{chips.map((chip) => <Badge key={chip.key} className="gap-1 bg-card">{chip.label}<button type="button" onClick={() => removeChip(chip.key)} className="focus-ring rounded" aria-label={`移除条件 ${chip.label}`}><X className="h-3 w-3" /></button></Badge>)}<button type="button" className="focus-ring rounded text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => setSearchParams({})}>清除全部</button></div> : null}
      <div className="mt-6 grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className={filterOpen ? 'block' : 'hidden lg:block'}>
          <form key={paramsKey} onSubmit={applyFilters} className="grid gap-4 lg:sticky lg:top-24">
            <FormField label="关键词" htmlFor="filter-q"><Input id="filter-q" name="q" defaultValue={filters.query} placeholder="标题、描述或分类" /></FormField>
            <FormField label="交易地点筛选" htmlFor="filter-location"><Input id="filter-location" name="location" defaultValue={filters.location} placeholder="例如：一组团、信通学院" /></FormField>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
              <FormField label="我的校区" htmlFor="filter-origin-campus"><Select id="filter-origin-campus" name="originCampus" defaultValue={originCampus}>{CAMPUS_OPTIONS.map((campus) => <option key={campus}>{campus}</option>)}</Select></FormField>
              <FormField label="我的起点" htmlFor="filter-origin"><Input id="filter-origin" name="origin" defaultValue={origin} placeholder="输入建筑或地点" /></FormField>
            </div>
            <FormField label="距离范围" htmlFor="filter-distance"><Select id="filter-distance" name="maxDistance" defaultValue={maxDistance ?? ''}><option value="">显示全部距离</option><option value="100">100 米内</option><option value="500">500 米内</option><option value="1000">1 公里内</option><option value="2000">2 公里内</option><option value="5000">5 公里内</option></Select></FormField>
            <FormField label="分类" htmlFor="filter-category"><Select id="filter-category" name="category" defaultValue={filters.category}>{CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></FormField>
            <div className="grid grid-cols-2 gap-2"><FormField label="最低价" htmlFor="filter-min"><Input id="filter-min" name="minPrice" type="number" min="0" step="0.01" defaultValue={filters.minPrice ?? ''} placeholder="¥ 0" /></FormField><FormField label="最高价" htmlFor="filter-max"><Input id="filter-max" name="maxPrice" type="number" min="0" step="0.01" defaultValue={filters.maxPrice ?? ''} placeholder="不限" /></FormField></div>
            <FormField label="成色" htmlFor="filter-condition"><Select id="filter-condition" name="condition" defaultValue={filters.condition}>{CONDITION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></FormField>
            <FormField label="状态" htmlFor="filter-status"><Select id="filter-status" name="status" defaultValue={filters.status}><option value="all">全部状态</option><option value="active">在售</option><option value="reserved">已预订</option></Select></FormField>
            <FormField label="排序" htmlFor="filter-sort"><Select id="filter-sort" name="sort" defaultValue={filters.sort}><option value="newest">最新发布</option><option value="price_asc">价格从低到高</option><option value="price_desc">价格从高到低</option></Select></FormField>
            <Button type="submit">应用筛选</Button>
          </form>
        </aside>
        <section aria-live="polite">
          {distanceError ? (
            <div className="mb-4 flex flex-col gap-3 rounded-md border border-border bg-muted/45 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" role="status">
              <div><p className="font-medium">距离筛选暂不可用</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{distanceError}</p></div>
              <Button type="button" size="sm" variant="outline" className="self-start sm:self-auto" onClick={retryDistance}><RotateCcw className="h-3.5 w-3.5" />重试距离计算</Button>
            </div>
          ) : null}
          {origin && !distanceError ? <p className="mb-3 text-xs text-muted-foreground">距离采用高德步行路线；跨校区商品会标注校区，不计算两校区间距离。{distanceLoading ? '正在计算，商品已先为你显示，距离范围将在完成后生效。' : ''}</p> : null}
          <ProductGrid products={visibleProducts} loading={loading || aiLoading} error={error} onRetry={load} emptyTitle="没有找到匹配商品" emptyDescription="试试减少条件、提高预算，或换一个关键词。" />
        </section>
      </div>
    </div>
  )
}
