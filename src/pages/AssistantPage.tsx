import { ArrowUp, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/form-controls'
import { askCampusHelper, type CampusHelperMessage } from '@/services/ai/campus-helper'
import { cn } from '@/lib/utils'

interface ChatMessage extends CampusHelperMessage {
  id: string
}

const QUICK_PROMPTS = [
  '我想卖一台旧电脑，发布前要准备哪些信息？',
  '帮我梳理一份二手商品面交检查清单',
  '怎么描述商品成色，买家更容易理解？',
]

function createMessage(role: CampusHelperMessage['role'], content: string): ChatMessage {
  return { id: crypto.randomUUID(), role, content }
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const fromUser = message.role === 'user'
  return (
    <article className={cn('flex', fromUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[88%] whitespace-pre-wrap break-words rounded-lg px-3.5 py-2.5 text-sm leading-6 sm:max-w-[78%]',
        fromUser ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground',
      )}>
        <span className="sr-only">{fromUser ? '你：' : '闲置助手：'}</span>
        {message.content}
      </div>
    </article>
  )
}

export function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const controllerRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  const conversation = useMemo(
    () => messages.slice(-20).map(({ role, content }) => ({ role, content })),
    [messages],
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending, error])

  useEffect(() => () => controllerRef.current?.abort(), [])

  async function requestAssistant(nextConversation: CampusHelperMessage[]) {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setSending(true)
    setError('')
    try {
      const reply = await askCampusHelper(nextConversation.slice(-20), controller.signal)
      setMessages((current) => [...current, createMessage('assistant', reply)])
    } catch (requestError) {
      if (controller.signal.aborted) return
      setError(requestError instanceof Error ? requestError.message : '闲置助手暂时无法响应，请稍后重试。')
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setSending(false)
      }
    }
  }

  function send(content: string) {
    const value = content.trim()
    if (!value || sending) return
    const userMessage = createMessage('user', value)
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setDraft('')
    void requestAssistant(nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    send(draft)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send(draft)
    }
  }

  return (
    <div className="page-container py-4 sm:py-6">
      <section className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card md:min-h-[calc(100vh-7rem)]">
        <header className="border-b border-border px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground" aria-hidden="true">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight">闲置助手</h1>
              <p className="truncate text-xs text-muted-foreground">商品发布、搜索与面交建议</p>
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite" aria-busy={sending}>
          <article className="flex justify-start">
            <div className="max-w-[88%] rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm leading-6 sm:max-w-[78%]">
              你好，我可以帮你整理商品信息、优化描述、准备面交检查项，也可以回答校园闲置交易相关问题。请不要发送密码、验证码或身份证等敏感信息。
            </div>
          </article>

          {messages.length === 0 ? (
            <div className="grid gap-2 pt-1 sm:grid-cols-3" aria-label="快捷提问">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="focus-ring rounded-md border border-border bg-background px-3 py-2.5 text-left text-xs leading-5 text-muted-foreground transition-colors hover:border-foreground/25 hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={sending}
                  onClick={() => send(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          {messages.map((message) => <MessageBubble key={message.id} message={message} />)}

          {sending ? (
            <div className="flex justify-start" role="status">
              <div className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
                正在整理回答…
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm" role="alert">
              <p className="text-destructive">{error}</p>
              {conversation.length > 0 ? (
                <Button className="mt-2" type="button" size="sm" variant="outline" onClick={() => void requestAssistant(conversation)}>
                  <RotateCcw className="h-3.5 w-3.5" />重新发送
                </Button>
              ) : null}
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <form className="border-t border-border bg-background p-3 sm:p-4" onSubmit={submit}>
          <label htmlFor="assistant-message" className="sr-only">向闲置助手提问</label>
          <div className="flex items-end gap-2">
            <Textarea
              id="assistant-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
              onKeyDown={handleKeyDown}
              className="min-h-11 max-h-36 resize-none py-2.5"
              rows={1}
              maxLength={4000}
              placeholder="输入问题，Enter 发送，Shift + Enter 换行"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={!draft.trim()} loading={sending} aria-label="发送消息">
              {!sending ? <ArrowUp className="h-4 w-4" /> : null}
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">回答仅供参考；交易前请核对商品、价格与对方身份。</p>
        </form>
      </section>
    </div>
  )
}
