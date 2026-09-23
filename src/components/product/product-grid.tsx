import { PackageSearch } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/product/product-card'
import type { Product } from '@/types/domain'

export function ProductGrid({ products, loading, error, onRetry, emptyTitle = '暂时没有商品', emptyDescription = '换个筛选条件，或稍后再来看看。', emptyActionLabel, onEmptyAction }: { products: Product[]; loading?: boolean; error?: string; onRetry?: () => void; emptyTitle?: string; emptyDescription?: string; emptyActionLabel?: string; onEmptyAction?: () => void }) {
  if (loading) return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, index) => <div key={index}><Skeleton className="aspect-[4/3] w-full" /><Skeleton className="mt-3 h-4 w-3/4" /><Skeleton className="mt-2 h-3 w-1/2" /></div>)}
    </div>
  )
  if (error) return (
    <div className="flex min-h-64 flex-col items-center justify-center border border-destructive/20 bg-destructive/5 px-6 text-center">
      <h2 className="text-sm font-semibold">商品加载失败</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>{onRetry ? <Button className="mt-4" variant="outline" onClick={onRetry}>重新加载</Button> : null}
    </div>
  )
  if (!products.length) return <EmptyState icon={PackageSearch} title={emptyTitle} description={emptyDescription} actionLabel={emptyActionLabel} onAction={onEmptyAction} />
  return <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
}
