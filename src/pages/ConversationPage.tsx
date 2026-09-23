import { ArrowLeft, MessageCircle, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/components/ui/toast'
import { marketplace } from '@/services/marketplace'
import { cn, formatDateTime, safeErrorMessage } from '@/lib/utils'
import type { Conversation, Message } from '@/types/domain'

export function ConversationPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true); setError('')
    try {
      const [chat, items] = await Promise.all([marketplace.getConversation(id), marketplace.listMessages(id)])
      setConversation(chat); setMessages(items)
    } catch (loadError) { setError(safeErrorMessage(loadError)) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!id) return
    return marketplace.subscribeMessages(id, (message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]))
  }, [id])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: messages.length > 1 ? 'smooth' : 'auto' }) }, [messages])

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!id) return
    const form = event.currentTarget
    const input = form.elements.namedItem('message') as HTMLInputElement
    const content = input.value.trim()
    if (!content) return
    setSending(true)
    try {
      const message = await marketplace.sendMessage(id, content)
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
      form.reset()
    } catch (sendError) { toast({ title: '消息未发送', description: safeErrorMessage(sendError), tone: 'error' }) }
    finally { setSending(false); input.focus() }
  }

  if (loading) return <div className="page-container max-w-4xl py-12 text-sm text-muted-foreground">正在加载会话…</div>
  if (error || !conversation) return <div className="page-container max-w-4xl py-12"><h1 className="text-xl font-semibold">无法打开会话</h1><p className="mt-2 text-sm text-muted-foreground">{error || '会话不存在，或你没有查看权限。'}</p><Button className="mt-4" variant="outline" onClick={() => navigate('/messages')}>返回消息</Button></div>
  const other = conversation.buyerId === session?.id ? conversation.seller : conversation.buyer

  return (
    <div className="mx-auto flex h-[calc(100dvh-6.55rem)] max-w-4xl flex-col border-x border-border bg-card">
      <header className="flex items-center gap-3 border-b border-border px-3 py-3 sm:px-4"><button type="button" className="focus-ring rounded-md p-2 hover:bg-muted" onClick={() => navigate('/messages')} aria-label="返回消息列表"><ArrowLeft className="h-5 w-5" /></button><Avatar name={other.username} src={other.avatarUrl} /><div className="min-w-0 flex-1"><h1 className="truncate text-sm font-semibold">{other.username}</h1><p className="truncate text-xs text-muted-foreground">关于 {conversation.product.title}</p></div><Link to={`/products/${conversation.productId}`} className="focus-ring hidden items-center gap-2 rounded-md border border-border p-1.5 pr-3 text-xs hover:bg-muted sm:flex"><span className="h-9 w-11 overflow-hidden rounded bg-muted">{conversation.product.images[0] ? <img src={conversation.product.images[0].url} alt="" className="h-full w-full object-cover" /> : null}</span>查看商品</Link></header>
      <div className="flex-1 overflow-y-auto bg-muted/25 px-3 py-5 sm:px-5" aria-live="polite">
        {!messages.length ? <div className="mx-auto mt-16 max-w-sm text-center"><MessageCircle className="mx-auto h-6 w-6 text-muted-foreground" /><h2 className="mt-3 text-sm font-semibold">开始沟通</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">可以先确认商品是否还在，再约定公共场所面交。</p></div> : <div className="space-y-3">{messages.map((message, index) => { const mine = message.senderId === session?.id; const showTime = index === 0 || new Date(message.createdAt).getTime() - new Date(messages[index - 1].createdAt).getTime() > 20 * 60_000; return <div key={message.id}>{showTime ? <p className="mb-3 text-center text-[11px] text-muted-foreground">{formatDateTime(message.createdAt)}</p> : null}<div className={cn('flex', mine ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[82%] rounded-lg px-3 py-2 text-sm leading-6 shadow-sm sm:max-w-[68%]', mine ? 'bg-primary text-primary-foreground' : 'border border-border bg-card')}><p className="whitespace-pre-wrap break-words">{message.content}</p><p className={cn('mt-0.5 text-right text-[10px]', mine ? 'text-primary-foreground/65' : 'text-muted-foreground')}>{mine && message.readAt ? '已读' : formatDateTime(message.createdAt)}</p></div></div></div> })}</div>}
        <div ref={endRef} />
      </div>
      <form className="flex items-center gap-2 border-t border-border bg-card p-3 sm:p-4" onSubmit={send}><Input name="message" maxLength={1000} placeholder="输入消息…" aria-label="消息内容" autoComplete="off" /><Button type="submit" size="icon" loading={sending} aria-label="发送消息"><Send className="h-4 w-4" /></Button></form>
    </div>
  )
}
