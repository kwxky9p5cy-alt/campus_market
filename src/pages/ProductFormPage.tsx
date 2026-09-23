import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ProductForm } from '@/features/products/ProductForm'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/components/ui/toast'
import { marketplace } from '@/services/marketplace'
import { safeErrorMessage } from '@/lib/utils'
import type { Product, ProductInput } from '@/types/domain'

export function ProductFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const { session } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(editing)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try { setProduct(await marketplace.getProduct(id)) }
    catch (loadError) { setError(safeErrorMessage(loadError)) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function submit(input: ProductInput, files: File[], keepImageIds: string[]) {
    try {
      const saved = product
        ? await marketplace.updateProduct(product.id, input, files, keepImageIds)
        : await marketplace.createProduct(input, files)
      toast({ title: product ? '修改已保存' : '商品已发布', description: '现在可以在商品详情中继续管理。', tone: 'success' })
      navigate(`/products/${saved.id}`)
    } catch (submitError) {
      toast({ title: product ? '保存失败' : '发布失败', description: safeErrorMessage(submitError), tone: 'error' })
      throw submitError
    }
  }

  if (loading) return <div className="page-container py-10 text-sm text-muted-foreground">正在加载商品…</div>
  if (error) return <div className="page-container py-10"><p className="text-sm text-destructive">{error}</p></div>
  if (editing && !product) return <div className="page-container py-10"><h1 className="text-xl font-semibold">商品不存在</h1><Link to="/profile" className="mt-3 inline-block text-sm underline">返回我的发布</Link></div>
  if (product && product.sellerId !== session?.id) return <div className="page-container py-10"><h1 className="text-xl font-semibold">无法编辑这个商品</h1><p className="mt-2 text-sm text-muted-foreground">只有发布者可以修改商品信息。</p></div>

  return (
    <div className="page-container py-5 sm:py-7">
      <Link to={product ? `/products/${product.id}` : '/'} className="focus-ring inline-flex items-center gap-1 rounded text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回</Link>
      <div className="mb-6 mt-4"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{product ? '编辑商品' : '发布闲置'}</h1><p className="mt-1 text-sm text-muted-foreground">{product ? '更新的信息会立即显示在商品详情中。' : '准确的信息能减少来回确认，也更容易成交。'}</p></div>
      <ProductForm key={product?.id ?? 'new'} product={product ?? undefined} onSubmit={submit} />
    </div>
  )
}
