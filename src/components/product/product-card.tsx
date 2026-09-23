import { Heart, ImageOff, MapPin } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { useFavorites } from '@/features/favorites/FavoritesProvider'
import { CONDITION_LABELS, PRODUCT_STATUS_LABELS } from '@/lib/constants'
import { cn, formatPrice, formatRelativeTime } from '@/lib/utils'
import type { Product } from '@/types/domain'

export function ProductCard({ product }: { product: Product }) {
  const { ids, toggle, loading } = useFavorites()
  const [imageFailed, setImageFailed] = useState(false)
  const favorite = ids.has(product.id)
  const unavailable = product.status === 'reserved' || product.status === 'sold'

  return (
    <article className="group min-w-0">
      <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
        <Link to={`/products/${product.id}`} className="focus-ring block aspect-[4/3]" aria-label={`查看 ${product.title}`}>
          {product.images[0] && !imageFailed ? (
            <img src={product.images[0].url} alt={product.title} loading="lazy" onError={() => setImageFailed(true)} className={cn('h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]', unavailable && 'saturate-[.7]')} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground"><ImageOff className="h-7 w-7" /><span className="sr-only">暂无图片</span></div>
          )}
        </Link>
        {unavailable ? <Badge className="absolute left-2 top-2 border-background/60 bg-background/95">{PRODUCT_STATUS_LABELS[product.status]}</Badge> : null}
        <button
          type="button"
          className="focus-ring absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground transition hover:bg-background disabled:opacity-60"
          onClick={() => void toggle(product.id)}
          disabled={loading}
          aria-label={favorite ? `取消收藏 ${product.title}` : `收藏 ${product.title}`}
          aria-pressed={favorite}
        >
          <Heart className={cn('h-4 w-4', favorite && 'fill-destructive text-destructive')} />
        </button>
      </div>
      <Link to={`/products/${product.id}`} className="focus-ring mt-3 block rounded-sm">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-sm font-medium group-hover:underline group-hover:underline-offset-4">{product.title}</h3>
          <span className="shrink-0 text-base font-semibold tabular-nums">{formatPrice(product.price)}</span>
        </div>
        <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span>{CONDITION_LABELS[product.condition]}</span><span aria-hidden="true">·</span>
          <span className="flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{product.location}</span><span aria-hidden="true">·</span>
          <span className="shrink-0">{formatRelativeTime(product.createdAt)}</span>
        </div>
      </Link>
    </article>
  )
}
