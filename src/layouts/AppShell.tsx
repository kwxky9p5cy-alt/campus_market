import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Heart, Home, LogOut, Menu, MessageCircle, Plus, Search, ShoppingBag, Sparkles, UserRound } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'
import { useAuth } from '@/features/auth/AuthProvider'
import { isDemoMode } from '@/services/marketplace'
import { cn } from '@/lib/utils'

const desktopLinks = [
  { to: '/', label: '首页' },
  { to: '/search', label: '分类' },
  { to: '/favorites', label: '收藏' },
  { to: '/messages', label: '消息' },
  { to: '/assistant', label: '闲置助手' },
]

const mobileLinks = [
  { to: '/', label: '首页', icon: Home },
  { to: '/favorites', label: '收藏', icon: Heart },
  { to: '/sell', label: '发布', icon: Plus },
  { to: '/messages', label: '消息', icon: MessageCircle },
  { to: '/profile', label: '我的', icon: UserRound },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { session, openAuth, signOut, requireAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isConversation = /^\/messages\/[^/]+$/.test(location.pathname)
  const isFocusedPage = isConversation || location.pathname === '/assistant'

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get('q')?.toString().trim()
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : '/search')
  }

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      {isDemoMode ? <div className="border-b border-border bg-secondary/55 px-4 py-1.5 text-center text-[11px] text-muted-foreground">演示模式 · 数据保存在当前浏览器。连接 Supabase 后自动启用真实多用户数据。</div> : null}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="page-container flex h-16 items-center gap-3">
          <Link to="/" className="focus-ring flex shrink-0 items-center gap-2 rounded-md" aria-label="Campus Market 首页">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">C</span>
            <span className="hidden text-sm font-semibold tracking-tight sm:block">Campus Market</span>
          </Link>
          <form onSubmit={submitSearch} className="relative min-w-0 flex-1 md:ml-3 md:max-w-md" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input name="q" defaultValue={location.pathname === '/search' ? new URLSearchParams(location.search).get('q') ?? '' : ''} className="pl-9" placeholder="搜索商品" aria-label="搜索商品" />
          </form>
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="主导航">
            {desktopLinks.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => cn('focus-ring rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground', isActive && 'bg-muted font-medium text-foreground')}>{item.label}</NavLink>)}
            <Button className="ml-2" size="sm" onClick={() => requireAuth(() => navigate('/sell'))}><Plus className="h-4 w-4" />发布闲置</Button>
            {session ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger className="focus-ring ml-1 rounded-full"><Avatar src={session.profile.avatarUrl} name={session.profile.username} /></DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={8} className="surface z-50 min-w-48 rounded-md p-1 shadow-lg">
                    <div className="px-2 py-2"><p className="truncate text-sm font-medium">{session.profile.username}</p><p className="truncate text-xs text-muted-foreground">{session.email}</p></div>
                    <DropdownMenu.Separator className="my-1 h-px bg-border" />
                    <DropdownMenu.Item asChild><Link className="focus-ring flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm outline-none hover:bg-muted" to="/profile"><UserRound className="h-4 w-4" />个人中心</Link></DropdownMenu.Item>
                    <DropdownMenu.Item asChild><Link className="focus-ring flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm outline-none hover:bg-muted" to="/trades"><ShoppingBag className="h-4 w-4" />我的交易</Link></DropdownMenu.Item>
                    <DropdownMenu.Item className="focus-ring flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm outline-none hover:bg-muted" onSelect={() => void signOut()}><LogOut className="h-4 w-4" />退出登录</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : <Button className="ml-1" size="sm" variant="ghost" onClick={() => openAuth('login')}>登录</Button>}
          </nav>
          <Link to="/assistant" className="focus-ring rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden" aria-label="打开闲置助手"><Sparkles className="h-5 w-5" /></Link>
          <button type="button" className="focus-ring rounded-md p-2 md:hidden" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="打开菜单" aria-expanded={mobileMenuOpen}><Menu className="h-5 w-5" /></button>
        </div>
        {mobileMenuOpen ? <div className="border-t border-border px-4 py-3 md:hidden"><div className="flex items-center justify-between text-sm"><span>{session ? `你好，${session.profile.username}` : '登录后可发布与交易'}</span>{session ? <button className="focus-ring rounded px-2 py-1 text-muted-foreground" onClick={() => void signOut()}>退出</button> : <Button size="sm" onClick={() => { openAuth('login'); setMobileMenuOpen(false) }}>登录</Button>}</div></div> : null}
      </header>
      <main>{children}</main>
      {!isFocusedPage ? <footer className="mt-16 hidden border-t border-border py-8 md:block"><div className="page-container flex items-center justify-between text-xs text-muted-foreground"><span>Campus Market · 校园集市</span><span>线下面交，请当面核对商品状态</span></div></footer> : null}
      {!isFocusedPage ? <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-border bg-background/98 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="移动端主导航">
        {mobileLinks.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={(event) => { if (to !== '/' && !session) { event.preventDefault(); requireAuth(() => navigate(to)) } }} className={({ isActive }) => cn('focus-ring flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground', isActive && 'font-medium text-primary', to === '/sell' && 'text-primary')}><Icon className={cn('h-5 w-5', to === '/sell' && 'rounded-md bg-primary p-1 text-primary-foreground')} />{label}</NavLink>)}
      </nav> : null}
    </div>
  )
}
