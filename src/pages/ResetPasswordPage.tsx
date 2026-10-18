import { useState } from 'react'
import { CheckCircle2, KeyRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormField, Input } from '@/components/ui/form-controls'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { safeErrorMessage } from '@/lib/utils'
import { marketplace } from '@/services/marketplace'

const passwordSchema = z.object({
  password: z.string().min(8, '密码至少需要 8 位'),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: '两次输入的密码不一致',
})

export function ResetPasswordPage() {
  const { session, loading, authError, openAuth } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const navigate = useNavigate()
  const { toast } = useToast()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setFieldErrors({})
    const form = new FormData(event.currentTarget)
    const parsed = passwordSchema.safeParse({
      password: String(form.get('password') ?? ''),
      confirmPassword: String(form.get('confirmPassword') ?? ''),
    })
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      return
    }

    setSubmitting(true)
    try {
      await marketplace.updatePassword(parsed.data.password)
      setCompleted(true)
      toast({ title: '密码已更新', description: '现在可以使用新密码登录。', tone: 'success' })
    } catch (error) {
      setFormError(safeErrorMessage(error, '密码更新失败，请重新打开邮件中的链接后再试。'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="page-container py-12 text-sm text-muted-foreground" role="status">正在验证密码重置链接…</div>
  }

  if (completed) {
    return (
      <main className="page-container flex min-h-[60vh] items-center justify-center py-10">
        <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">密码重置成功</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">新密码已经生效，你可以继续使用校园集市。</p>
          <Button className="mt-6 w-full" onClick={() => navigate('/')}>返回首页</Button>
        </section>
      </main>
    )
  }

  if (!session || authError) {
    return (
      <main className="page-container flex min-h-[60vh] items-center justify-center py-10">
        <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <KeyRound className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">重置链接无效或已过期</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">请重新发送密码重置邮件，并使用最新邮件中的链接。</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button onClick={() => openAuth('forgot')}>重新发送邮件</Button>
            <Button variant="outline" onClick={() => navigate('/')}>返回首页</Button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page-container flex min-h-[60vh] items-center justify-center py-10">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold tracking-tight">设置新密码</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">请为 {session.email} 设置一个至少 8 位的新密码。</p>
        <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate>
          <FormField label="新密码" htmlFor="reset-password" required error={fieldErrors.password} hint="至少 8 位">
            <Input id="reset-password" name="password" type="password" autoComplete="new-password" aria-invalid={Boolean(fieldErrors.password)} />
          </FormField>
          <FormField label="确认新密码" htmlFor="reset-confirm-password" required error={fieldErrors.confirmPassword}>
            <Input id="reset-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" aria-invalid={Boolean(fieldErrors.confirmPassword)} />
          </FormField>
          {formError ? <div className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{formError}</div> : null}
          <Button type="submit" loading={submitting}>更新密码</Button>
        </form>
      </section>
    </main>
  )
}
