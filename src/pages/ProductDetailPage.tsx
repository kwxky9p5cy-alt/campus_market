import { ArrowLeft, Heart, MapPin, MessageCircle, Pencil, ShoppingBag, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { useFavorites } from '@/features/favorites/FavoritesProvider'
import { useToast } from '@/components/ui/toast'
import { CATEGORY_LABELS, CONDITION_LABELS, PRODUCT_STATUS_LABELS, TRADE_STATUS_LABELS } from '@/lib/constants'
import { marketplace } from '@/services/marketplace'
import { formatCampusLocation } from '@/services/campus-locations'
import { cn, formatDateTime, formatPrice, safeErrorMessage } from '@/lib/utils'
import type { Product, ProductStatus, TradeRequest } from '@/types/domain'

export function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, requireAuth } = useAuth()
  const { ids, toggle } = useFavorites()
  const { toast } = useToast()
  const [product, setProduct] = useState<Product | null>(null)
  const [trade, setTrade] = useState<TradeRequest | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true); setError('')
    try {
      const item = await marketplace.getProduct(id)
      setProduct(item)
      if (session) {
        const trades = await marketplace.listTrades()
        setTrade(trades.find((entry) => entry.productId === id && entry.buyerId === session.id && ['pending', 'accepted'].includes(entry.status)) ?? null)
      }
    } catch (loadError) { setError(safeErrorMessage(loadError)) }
    finally { setLoading(false) }
  }, [id, session])

  useEffect(() => { void load() }, [load])

  async function updateStatus(status: ProductStatus) {
    if (!product) return
    setWorking(true)
    try { setProduct(await marketplace.setProductStatus(product.id, status)); toast({ title: `商品已${status === 'active' ? '重新上架' : PRODUCT_STATUS_LABELS[status]}`, tone: 'success' }) }
    catch (statusError) { toast({ title: '状态更新失败', description: safeErrorMessage(statusError), tone: 'error' }) }
    finally { setWorking(false) }
  }

  async function deleteProduct() {
    if (!product) return
    try { await marketplace.deleteProduct(product.id); toast({ title: '商品已删除', tone: 'success' }); navigate('/profile') }
    catch (deleteError) { toast({ title: '删除失败', description: safeErrorMessage(deleteError), tone: 'error' }) }
  }

  async function startTrade() {
    if (!product || !requireAuth()) return
    setWorking(true)
    try {
      const nextTrade = await marketplace.createTrade(product.id)
      setTrade(nextTrade)
      const conversation = await marketplace.getOrCreateConversation(product.id, nextTrade.id)
      toast({ title: '交易请求已发送', description: '你可以和卖家确认面交时间。', tone: 'success' })
      navigate(`/messages/${conversation.id}`)
    } catch (tradeError) { toast({ title: '请求未发送', description: safeErrorMessage(tradeError), tone: 'error' }) }
    finally { setWorking(false) }
  }

  async function contactSeller() {
    if (!product || !requireAuth()) return
    setWorking(true)
    try { const conversation = await marketplace.getOrCreateConversation(product.id, trade?.id); navigate(`/messages/${conversation.id}`) }
    catch (contactError) { toast({ title: '暂时无法联系卖家', description: safeErrorMessage(contactError), tone: 'error' }) }
    finally { setWorking(false) }
  }

  if (loading) return <div className="page-container grid gap-8 py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]"><Skeleton className="aspect-[4/3] w-full" /><div className="space-y-4"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-10 w-1/2" /><Skeleton className="h-32 w-full" /></div></div>
  if (error) return <div className="page-container py-12"><h1 className="text-xl font-semibold">商品加载失败</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-4" variant="outline" onClick={load}>重新加载</Button></div>
  if (!product) return <div className="page-container py-12"><h1 className="text-xl font-semibold">商品不存在或已被删除</h1><Button asChild className="mt-4" variant="outline"><Link to="/">返回首页</Link></Button></div>

  const owner = session?.id === product.sellerId
  const available = product.status === 'active'
  const favorite = ids.has(product.id)

  const BuyerActions = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn('flex gap-2', mobile && 'w-full')}>
      <Button variant="outline" size={mobile ? 'icon' : 'default'} onClick={() => void toggle(product.id)} aria-label={favorite ? '取消收藏' : '收藏'} aria-pressed={favorite}><Heart className={cn('h-4 w-4', favorite && 'fill-destructive text-destructive')} />{mobile ? null : favorite ? '已收藏' : '收藏'}</Button>
      {trade ? <Button className="flex-1" onClick={() => void contactSeller()} loading={working}><MessageCircle className="h-4 w-4" />{TRADE_STATUS_LABELS[trade.status]}</Button> : <Button className="flex-1" onClick={() => void startTrade()} loading={working} disabled={!available}><ShoppingBag className="h-4 w-4" />{available ? '我想要' : PRODUCT_STATUS_LABELS[product.status]}</Button>}
      {!trade && available && !mobile ? <Button variant="secondary" onClick={() => void contactSeller()} loading={working}><MessageCircle className="h-4 w-4" />先聊聊</Button> : null}
    </div>
  )

  return (
    <div className="page-container py-5 sm:py-7">
      <button type="button" onClick={() => navigate(-1)} className="focus-ring inline-flex items-center gap-1 rounded text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回</button>
      <div className="mt-4 grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)] lg:gap-10">
        <section aria-label="商品图片">
          <div className="aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted">{product.images[activeImage] ? <img src={product.images[activeImage].url} alt={`${product.title} 图片 ${activeImage + 1}`} className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center text-sm text-muted-foreground">暂无图片</div>}</div>
          {product.images.length > 1 ? <div className="mt-3 flex gap-2 overflow-x-auto">{product.images.map((image, index) => <button type="button" key={image.id} onClick={() => setActiveImage(index)} className={cn('focus-ring h-16 w-20 shrink-0 overflow-hidden rounded-md border bg-muted', index === activeImage ? 'border-primary ring-1 ring-primary' : 'border-border')} aria-label={`查看第 ${index + 1} 张图片`} aria-pressed={index === activeImage}><img src={image.url} alt="" className="h-full w-full object-cover" /></button>)}</div> : null}
        </section>
        <section className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Badge className={cn(product.status === 'active' && 'border-primary/20 bg-primary/10 text-primary', product.status === 'reserved' && 'border-amber-300 bg-amber-50 text-amber-800')}>{PRODUCT_STATUS_LABELS[product.status]}</Badge><Badge>{CATEGORY_LABELS[product.category]}</Badge></div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{product.title}</h1>
          <div className="mt-4 flex items-baseline gap-3"><span className="text-3xl font-semibold tracking-tight tabular-nums">{formatPrice(product.price)}</span>{product.originalPrice ? <span className="text-sm text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span> : null}</div>
          <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-y border-border py-4 text-sm"><div><dt className="text-xs text-muted-foreground">成色</dt><dd className="mt-1 font-medium">{CONDITION_LABELS[product.condition]}</dd></div><div><dt className="text-xs text-muted-foreground">发布时间</dt><dd className="mt-1 font-medium">{formatDateTime(product.createdAt)}</dd></div><div className="col-span-2"><dt className="text-xs text-muted-foreground">面交地点</dt><dd className="mt-1 flex items-center gap-1 font-medium"><MapPin className="h-4 w-4 text-muted-foreground" />{formatCampusLocation(product.location)}</dd></div></dl>
          <div className="mt-5 hidden md:block">{owner ? <OwnerActions product={product} working={working} onStatus={updateStatus} onDelete={deleteProduct} /> : <BuyerActions />}</div>
          <div className="mt-7"><h2 className="text-sm font-semibold">商品描述</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/85">{product.description}</p></div>
          <div className="mt-7 border-t border-border pt-5"><h2 className="text-sm font-semibold">卖家</h2><div className="mt-3 flex items-center gap-3"><Avatar src={product.seller.avatarUrl} name={product.seller.username} className="h-11 w-11" /><div className="min-w-0"><p className="truncate text-sm font-medium">{product.seller.username}</p><p className="truncate text-xs text-muted-foreground">{product.seller.bio || '已加入校园集市'}</p></div></div></div>
        </section>
      </div>
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/98 p-3 md:hidden">{owner ? <OwnerActions product={product} working={working} onStatus={updateStatus} onDelete={deleteProduct} compact /> : <BuyerActions mobile />}</div>
    </div>
  )
}

function OwnerActions({ product, working, onStatus, onDelete, compact }: { product: Product; working: boolean; onStatus: (status: ProductStatus) => void; onDelete: () => void; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" className={compact ? 'flex-1' : ''}><Link to={`/products/${product.id}/edit`}><Pencil className="h-4 w-4" />编辑</Link></Button>
      {product.status === 'inactive' ? <Button disabled={working} onClick={() => onStatus('active')} className={compact ? 'flex-1' : ''}>重新上架</Button> : product.status === 'active' ? <><Button disabled={working} variant="secondary" onClick={() => onStatus('reserved')}>标记预订</Button><Button disabled={working} variant="outline" onClick={() => onStatus('inactive')}>下架</Button></> : null}
      {product.status === 'reserved' ? <><Button disabled={working} onClick={() => onStatus('sold')}>标记已售</Button><Button disabled={working} variant="outline" onClick={() => onStatus('active')}>恢复在售</Button></> : null}
      <ConfirmDialog trigger={<Button variant="ghost" size={compact ? 'icon' : 'default'} aria-label="删除商品"><Trash2 className="h-4 w-4" />{compact ? null : '删除'}</Button>} title="删除这个商品？" description="商品、收藏记录和相关未完成记录可能一并删除。此操作无法撤销。" confirmLabel="确认删除" destructive onConfirm={onDelete} />
    </div>
  )
}
