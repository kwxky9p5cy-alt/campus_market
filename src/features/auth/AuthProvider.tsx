import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FormField, Input } from '@/components/ui/form-controls'
import { useToast } from '@/components/ui/toast'
import { marketplace } from '@/services/marketplace'
import { safeErrorMessage } from '@/lib/utils'
import type { UserSession } from '@/types/domain'

type AuthMode = 'login' | 'signup'
interface AuthContextValue {
  session: UserSession | null
  loading: boolean
  openAuth: (mode?: AuthMode) => void
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  requireAuth: (onAuthenticated?: () => void) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)
const loginSchema = z.object({ email: z.string().email('请输入有效邮箱'), password: z.string().min(8, '密码至少需要 8 位') })
const signupSchema = loginSchema.extend({ username: z.string().trim().min(2, '昵称至少 2 个字').max(24, '昵称最多 24 个字') })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>('login')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [afterAuth, setAfterAuth] = useState<(() => void) | null>(null)
  const { toast } = useToast()

  const refreshSession = useCallback(async () => {
    try { setSession(await marketplace.getSession()) } catch { setSession(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void refreshSession()
    return marketplace.subscribe(() => { void refreshSession() })
  }, [refreshSession])

  const openAuth = useCallback((nextMode: AuthMode = 'login') => {
    setMode(nextMode)
    setFormError('')
    setFieldErrors({})
    setDialogOpen(true)
  }, [])

  const requireAuth = useCallback((callback?: () => void) => {
    if (session) { callback?.(); return true }
    if (callback) setAfterAuth(() => callback)
    openAuth('login')
    return false
  }, [openAuth, session])

  const signOut = useCallback(async () => {
    await marketplace.signOut()
    setSession(null)
    toast({ title: '已安全退出', tone: 'success' })
  }, [toast])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')
    setFieldErrors({})
    const form = new FormData(event.currentTarget)
    const values = { email: String(form.get('email') ?? ''), password: String(form.get('password') ?? ''), username: String(form.get('username') ?? '') }
    const parsed = mode === 'login' ? loginSchema.safeParse(values) : signupSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      setSubmitting(false)
      return
    }
    try {
      const next = mode === 'login'
        ? await marketplace.signIn(values.email, values.password)
        : await marketplace.signUp(values.email, values.password, values.username)
      if (!next) {
        setDialogOpen(false)
        toast({ title: '注册成功', description: '请前往邮箱完成验证，然后返回登录。', tone: 'success' })
      } else {
        setSession(next)
        setDialogOpen(false)
        toast({ title: mode === 'login' ? '欢迎回来' : '账号创建成功', tone: 'success' })
        window.setTimeout(() => { afterAuth?.(); setAfterAuth(null) }, 0)
      }
    } catch (error) {
      setFormError(safeErrorMessage(error, '登录失败，请重试。'))
    } finally {
      setSubmitting(false)
    }
  }

  const value = useMemo(() => ({ session, loading, openAuth, signOut, refreshSession, requireAuth }), [session, loading, openAuth, signOut, refreshSession, requireAuth])

  return (
    <AuthContext.Provider value={value}>
      {children}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={mode === 'login' ? '登录校园集市' : '创建账号'} description={mode === 'login' ? '登录后可收藏、发布和联系卖家。' : '无需学校认证，使用常用邮箱即可。'}>
        <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
          {mode === 'signup' ? (
            <FormField label="昵称" htmlFor="auth-username" required error={fieldErrors.username}>
              <Input id="auth-username" name="username" autoComplete="nickname" placeholder="例如：小林" aria-invalid={Boolean(fieldErrors.username)} />
            </FormField>
          ) : null}
          <FormField label="邮箱" htmlFor="auth-email" required error={fieldErrors.email}>
            <Input id="auth-email" name="email" type="email" autoComplete="email" defaultValue={marketplace.mode === 'demo' ? 'demo@campus.market' : ''} aria-invalid={Boolean(fieldErrors.email)} />
          </FormField>
          <FormField label="密码" htmlFor="auth-password" required error={fieldErrors.password} hint={marketplace.mode === 'demo' ? '演示账号密码：demo1234' : '至少 8 位'}>
            <Input id="auth-password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} defaultValue={marketplace.mode === 'demo' ? 'demo1234' : ''} aria-invalid={Boolean(fieldErrors.password)} />
          </FormField>
          {formError ? <div className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{formError}</div> : null}
          <Button type="submit" loading={submitting}>{mode === 'login' ? '登录' : '注册'}</Button>
          <button type="button" className="focus-ring rounded text-sm text-muted-foreground hover:text-foreground" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setFormError(''); setFieldErrors({}) }}>
            {mode === 'login' ? '还没有账号？立即注册' : '已有账号？返回登录'}
          </button>
        </form>
      </Dialog>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, openAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading && !session) openAuth('login')
  }, [loading, session, openAuth])

  if (loading) return <div className="page-container py-12 text-sm text-muted-foreground">正在确认登录状态…</div>
  if (!session) return (
    <div className="page-container flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-xl font-semibold">登录后继续</h1>
      <p className="mt-2 text-sm text-muted-foreground">这个页面包含你的个人内容。</p>
      <div className="mt-5 flex gap-2"><Button onClick={() => openAuth('login')}>登录</Button><Button variant="outline" onClick={() => navigate('/', { state: { from: location.pathname } })}>返回首页</Button></div>
    </div>
  )
  return children
}
