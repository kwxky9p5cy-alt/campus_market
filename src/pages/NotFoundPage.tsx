import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <div className="page-container flex min-h-[65vh] flex-col items-center justify-center text-center"><p className="text-sm text-muted-foreground">404</p><h1 className="mt-2 text-2xl font-semibold">这个页面不存在</h1><p className="mt-2 text-sm text-muted-foreground">链接可能已失效，也可能输入有误。</p><Button asChild className="mt-5"><Link to="/">返回首页</Link></Button></div>
}
