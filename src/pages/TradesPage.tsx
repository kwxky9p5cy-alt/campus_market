import { Check, MessageCircle, ShoppingBag, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/components/ui/toast'
import { TRADE_STATUS_LABELS } from '@/lib/constants'
import { marketplace } from '@/services/marketplace'
import { cn, formatPrice, formatRelativeTime, safeErrorMessage } from '@/lib/utils'
import type { TradeRequest, TradeStatus } from '@/types/domain'

type TradeTab = 'all' | 'pending' | 'accepted' | 'completed' | 'closed'

export function TradesPage() {
  const { session } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [trades, setTrades] = useState<TradeRequest[]>([])
  const [tab, setTab] = useState<TradeTab>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workingId, setWorkingId] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setTrades(await marketplace.listTrades()) }
    catch (loadError) { setError(safeErrorMessage(loadError)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(); return marketplace.subscribe(() => { void load() }) }, [load])

  const filtered = useMemo(() => trades.filter((trade) => tab === 'all' || trade.status === tab || (tab === 'closed' && ['rejected', 'cancelled'].includes(trade.status))), [trades, tab])
  async function transition(trade: TradeRequest, status: TradeStatus) {
    setWorkingId(trade.id)
    try { await marketplace.updateTrade(trade.id, status); toast({ title: status === 'accepted' ? '已接受交易请求' : status === 'completed' ? '交易已完成' : status === 'rejected' ? '已拒绝请求' : '请求已取消', tone: 'success' }); await load() }
    catch (transitionError) { toast({ title: '操作失败', description: safeErrorMessage(transitionError), tone: 'error' }) }
    finally { setWorkingId('') }
  }
  async function openChat(trade: TradeRequest) {
    try {
      const conversations = await marketplace.listConversations()
      const existing = conversations.find((item) => item.tradeRequestId === trade.id || (item.productId === trade.productId && item.buyerId === trade.buyerId))
      if (existing) navigate(`/messages/${existing.id}`)
      else if (trade.buyerId === session?.id) navigate(`/messages/${(await marketplace.getOrCreateConversation(trade.productId, trade.id)).id}`)
      else throw new Error('买家还没有开始会话。')
    } catch (chatError) { toast({ title: '暂时无法打开会话', description: safeErrorMessage(chatError), tone: 'error' }) }
  }

  return (
    <div className="page-container py-5 sm:py-7">
      <div className="border-b border-border pb-5"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">我的交易</h1><p className="mt-1 text-sm text-muted-foreground">处理交易请求并跟进线下面交</p></div>
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist">{([['all', '全部'], ['pending', '待处理'], ['accepted', '进行中'], ['completed', '已完成'], ['closed', '已结束']] as Array<[TradeTab, string]>).map(([value, label]) => <button type="button" role="tab" aria-selected={tab === value} key={value} onClick={() => setTab(value)} className={cn('focus-ring -mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground', tab === value && 'border-primary font-medium text-foreground')}>{label}</button>)}</div>
      <div className="mt-5 space-y-3">
        {loading ? <p className="py-12 text-center text-sm text-muted-foreground">正在加载交易…</p> : error ? <div className="border border-destructive/20 bg-destructive/5 p-5 text-sm"><p>{error}</p><Button className="mt-3" size="sm" variant="outline" onClick={load}>重试</Button></div> : !filtered.length ? <EmptyState icon={ShoppingBag} title="没有符合条件的交易" description="从商品详情发起交易后，进度会显示在这里。" /> : filtered.map((trade) => {
          const isSeller = trade.sellerId === session?.id
          const other = isSeller ? trade.buyer : trade.seller
          return <article key={trade.id} className="surface rounded-lg p-4"><div className="flex gap-3"><Link to={`/products/${trade.productId}`} className="focus-ring h-20 w-24 shrink-0 overflow-hidden rounded-md bg-muted">{trade.product.images[0] ? <img src={trade.product.images[0].url} alt={trade.product.title} className="h-full w-full object-cover" /> : null}</Link><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs text-muted-foreground">{isSeller ? '买家请求' : '我的购买'} · {formatRelativeTime(trade.updatedAt)}</p><Link to={`/products/${trade.productId}`} className="focus-ring mt-1 block truncate rounded text-sm font-medium hover:underline">{trade.product.title}</Link></div><Badge className={cn(trade.status === 'accepted' && 'border-primary/20 bg-primary/10 text-primary', trade.status === 'pending' && 'border-amber-300 bg-amber-50 text-amber-800')}>{TRADE_STATUS_LABELS[trade.status]}</Badge></div><div className="mt-3 flex items-center gap-2"><Avatar name={other.username} src={other.avatarUrl} className="h-7 w-7" /><span className="text-xs text-muted-foreground">{other.username}</span><span className="ml-auto text-sm font-semibold">{formatPrice(trade.product.price)}</span></div></div></div>
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3"><Button size="sm" variant="outline" onClick={() => void openChat(trade)}><MessageCircle className="h-4 w-4" />聊天</Button>{trade.status === 'pending' && isSeller ? <><Button size="sm" variant="outline" disabled={workingId === trade.id} onClick={() => void transition(trade, 'rejected')}><X className="h-4 w-4" />拒绝</Button><Button size="sm" loading={workingId === trade.id} onClick={() => void transition(trade, 'accepted')}><Check className="h-4 w-4" />接受</Button></> : null}{trade.status === 'pending' && !isSeller ? <ConfirmDialog trigger={<Button size="sm" variant="ghost">取消请求</Button>} title="取消交易请求？" description="取消后卖家无需再处理。如果仍想购买，可以稍后重新发起。" confirmLabel="确认取消" onConfirm={() => transition(trade, 'cancelled')} /> : null}{trade.status === 'accepted' && !isSeller ? <ConfirmDialog trigger={<Button size="sm" variant="outline">取消交易</Button>} title="取消这次交易？" description="商品会恢复为在售，其他买家可以重新发起请求。" confirmLabel="确认取消" onConfirm={() => transition(trade, 'cancelled')} /> : null}{trade.status === 'accepted' ? <ConfirmDialog trigger={<Button size="sm">确认完成</Button>} title="确认已经面交？" description="请在当面检查商品并完成交付后操作。确认后商品会标记为已售。" confirmLabel="完成交易" onConfirm={() => transition(trade, 'completed')} /> : null}</div>
          </article>
        })}
      </div>
    </div>
  )
}
