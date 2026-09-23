import { Heart, MessageCircle, Package, Save, ShoppingBag } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormField, Input, Textarea } from '@/components/ui/form-controls'
import { ProductGrid } from '@/components/product/product-grid'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/components/ui/toast'
import { PRODUCT_STATUS_LABELS } from '@/lib/constants'
import { marketplace } from '@/services/marketplace'
import { cn, safeErrorMessage } from '@/lib/utils'
import type { Product, ProductStatus } from '@/types/domain'

export function ProfilePage() {
  const { session, refreshSession } = useAuth()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [status, setStatus] = useState<ProductStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    if (!session) return
    setLoading(true); setError('')
    try { setProducts(await marketplace.listProducts({ sellerId: session.id, sort: 'newest' })) }
    catch (loadError) { setError(safeErrorMessage(loadError)) }
    finally { setLoading(false) }
  }, [session])
  useEffect(() => { void load(); return marketplace.subscribe(() => { void load() }) }, [load])
  const visible = useMemo(() => status === 'all' ? products : products.filter((item) => item.status === status), [products, status])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const username = String(form.get('username') ?? '').trim()
    const bio = String(form.get('bio') ?? '').trim()
    if (username.length < 2) { toast({ title: '昵称至少需要 2 个字', tone: 'error' }); return }
    setSaving(true)
    try { await marketplace.updateProfile({ username, bio: bio || null }); await refreshSession(); toast({ title: '个人资料已保存', tone: 'success' }) }
    catch (saveError) { toast({ title: '保存失败', description: safeErrorMessage(saveError), tone: 'error' }) }
    finally { setSaving(false) }
  }

  if (!session) return null
  return (
    <div className="page-container py-5 sm:py-7">
      <div className="grid gap-7 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="surface rounded-lg p-4"><div className="flex items-center gap-3"><Avatar name={session.profile.username} src={session.profile.avatarUrl} className="h-12 w-12" /><div className="min-w-0"><h1 className="truncate text-lg font-semibold">{session.profile.username}</h1><p className="truncate text-xs text-muted-foreground">{session.email}</p></div></div><form className="mt-5 grid gap-4" onSubmit={saveProfile}><FormField label="昵称" htmlFor="profile-name"><Input id="profile-name" name="username" defaultValue={session.profile.username} maxLength={24} /></FormField><FormField label="简介" htmlFor="profile-bio"><Textarea id="profile-bio" name="bio" defaultValue={session.profile.bio ?? ''} maxLength={160} className="min-h-24" placeholder="简单介绍你的交易偏好" /></FormField><Button type="submit" size="sm" loading={saving}><Save className="h-4 w-4" />保存资料</Button></form></section>
          <nav className="surface rounded-lg p-2" aria-label="个人内容"><Link className="focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-muted" to="/favorites"><Heart className="h-4 w-4 text-muted-foreground" />我的收藏</Link><Link className="focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-muted" to="/trades"><ShoppingBag className="h-4 w-4 text-muted-foreground" />我的交易</Link><Link className="focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-muted" to="/messages"><MessageCircle className="h-4 w-4 text-muted-foreground" />我的消息</Link></nav>
        </aside>
        <section>
          <div className="flex items-end justify-between gap-4"><div><div className="flex items-center gap-2"><Package className="h-5 w-5" /><h2 className="text-xl font-semibold tracking-tight">我的发布</h2></div><p className="mt-1 text-sm text-muted-foreground">管理状态、价格和商品信息</p></div><Button asChild><Link to="/sell">发布闲置</Link></Button></div>
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-border">{(['all', 'active', 'reserved', 'sold', 'inactive'] as const).map((value) => <button key={value} type="button" onClick={() => setStatus(value)} className={cn('focus-ring -mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground', status === value && 'border-primary font-medium text-foreground')}>{value === 'all' ? '全部' : PRODUCT_STATUS_LABELS[value]} <Badge className="ml-1 border-0 px-1.5">{value === 'all' ? products.length : products.filter((item) => item.status === value).length}</Badge></button>)}</div>
          <div className="mt-6"><ProductGrid products={visible} loading={loading} error={error} onRetry={load} emptyTitle="这个状态下还没有商品" emptyDescription="发布后可在这里编辑、下架或更新交易状态。" /></div>
        </section>
      </div>
    </div>
  )
}
