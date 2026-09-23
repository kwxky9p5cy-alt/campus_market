import { MessageCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/features/auth/AuthProvider'
import { marketplace } from '@/services/marketplace'
import { formatRelativeTime, safeErrorMessage } from '@/lib/utils'
import type { Conversation } from '@/types/domain'

export function MessagesPage() {
  const { session } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setConversations(await marketplace.listConversations()) }
    catch (loadError) { setError(safeErrorMessage(loadError)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(); return marketplace.subscribe(() => { void load() }) }, [load])

  return (
    <div className="page-container max-w-4xl py-5 sm:py-7">
      <div className="border-b border-border pb-5"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">消息</h1><p className="mt-1 text-sm text-muted-foreground">围绕具体商品沟通，面交前确认时间和地点</p></div>
      <div className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
        {loading ? <p className="p-10 text-center text-sm text-muted-foreground">正在加载消息…</p> : error ? <div className="p-8 text-center"><p className="text-sm text-destructive">{error}</p><Button className="mt-3" variant="outline" onClick={load}>重新加载</Button></div> : !conversations.length ? <EmptyState icon={MessageCircle} title="还没有消息" description="从商品详情联系卖家后，会话会显示在这里。" /> : conversations.map((conversation) => {
          const other = conversation.buyerId === session?.id ? conversation.seller : conversation.buyer
          return <Link key={conversation.id} to={`/messages/${conversation.id}`} className="focus-ring flex gap-3 border-b border-border p-4 last:border-0 hover:bg-muted/45"><Avatar name={other.username} src={other.avatarUrl} className="h-11 w-11" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-medium">{other.username}</span>{conversation.unreadCount ? <Badge className="border-primary/20 bg-primary/10 text-primary">{conversation.unreadCount} 条新消息</Badge> : null}<span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatRelativeTime(conversation.lastMessage?.createdAt ?? conversation.updatedAt)}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">关于：{conversation.product.title}</p><p className="mt-1 truncate text-sm">{conversation.lastMessage?.content ?? '还没有消息，打个招呼吧。'}</p></div><div className="hidden h-14 w-16 shrink-0 overflow-hidden rounded bg-muted sm:block">{conversation.product.images[0] ? <img src={conversation.product.images[0].url} alt="" className="h-full w-full object-cover" /> : null}</div></Link>
        })}
      </div>
    </div>
  )
}
