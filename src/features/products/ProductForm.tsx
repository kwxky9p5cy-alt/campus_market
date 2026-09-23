import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, Sparkles, Star, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormField, Input, Select, Textarea } from '@/components/ui/form-controls'
import { useToast } from '@/components/ui/toast'
import { ACCEPTED_IMAGE_TYPES, CATEGORY_OPTIONS, CONDITION_OPTIONS, MAX_IMAGE_BYTES, MAX_IMAGES } from '@/lib/constants'
import { autofillProduct } from '@/services/ai/autofill'
import { safeErrorMessage } from '@/lib/utils'
import type { Product, ProductInput } from '@/types/domain'

const optionalMoney = z.preprocess((value) => value == null || value === '' || Number.isNaN(value) ? null : Number(value), z.number().nonnegative().max(1_000_000).nullable())
const schema = z.object({
  title: z.string().trim().min(2, '商品名称至少 2 个字').max(80, '商品名称最多 80 个字'),
  category: z.enum(['digital', 'books', 'life', 'sports', 'other']),
  originalPrice: optionalMoney,
  price: z.coerce.number({ invalid_type_error: '请输入售价' }).positive('售价必须大于 0').max(1_000_000, '售价过高，请检查'),
  condition: z.enum(['new', 'like_new', 'good', 'fair']),
  description: z.string().trim().min(10, '请至少写 10 个字，说明商品实际情况').max(2000, '描述最多 2000 个字'),
  location: z.string().trim().min(2, '请填写面交地点').max(80, '地点最多 80 个字'),
}).refine((value) => value.originalPrice == null || value.originalPrice >= value.price, { path: ['originalPrice'], message: '原价应不低于售价' })

type Values = z.infer<typeof schema>

interface NewImage { file: File; url: string }

export function ProductForm({ product, onSubmit }: { product?: Product; onSubmit: (input: ProductInput, files: File[], keepImageIds: string[]) => Promise<void> }) {
  const [rawText, setRawText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMissing, setAiMissing] = useState<string[]>([])
  const [newImages, setNewImages] = useState<NewImage[]>([])
  const [keepImageIds, setKeepImageIds] = useState(product?.images.map((item) => item.id) ?? [])
  const [imageError, setImageError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: product?.title ?? '', category: product?.category ?? 'digital', originalPrice: product?.originalPrice ?? null, price: product?.price ?? 0, condition: product?.condition ?? 'good', description: product?.description ?? '', location: product?.location ?? '',
    },
  })

  const keptImages = useMemo(() => product?.images.filter((item) => keepImageIds.includes(item.id)) ?? [], [product, keepImageIds])
  const totalImages = keptImages.length + newImages.length

  function selectImages(files: FileList | null) {
    setImageError('')
    if (!files) return
    const incoming = Array.from(files)
    if (totalImages + incoming.length > MAX_IMAGES) { setImageError(`最多上传 ${MAX_IMAGES} 张图片。`); return }
    const invalid = incoming.find((file) => !ACCEPTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES)
    if (invalid) { setImageError(`“${invalid.name}”格式不支持或超过 5 MB。`); return }
    setNewImages((current) => [...current, ...incoming.map((file) => ({ file, url: URL.createObjectURL(file) }))])
  }

  function removeNew(index: number) {
    setNewImages((current) => { URL.revokeObjectURL(current[index].url); return current.filter((_, itemIndex) => itemIndex !== index) })
  }

  async function runAutofill() {
    if (rawText.trim().length < 4) { toast({ title: '再多写一点商品信息', description: '描述型号、使用情况、价格或面交地点，填写会更准确。', tone: 'info' }); return }
    setAiLoading(true)
    try {
      const result = await autofillProduct({ rawText, imageNames: newImages.map((item) => item.file.name) })
      if (result.title) setValue('title', result.title, { shouldValidate: true })
      if (result.category) setValue('category', result.category)
      if (result.price != null) setValue('price', result.price, { shouldValidate: true })
      if (result.condition) setValue('condition', result.condition)
      if (result.description) setValue('description', result.description, { shouldValidate: true })
      if (result.location) setValue('location', result.location, { shouldValidate: true })
      setAiMissing(result.missingFields)
      toast({ title: '已填写可确认的信息', description: result.missingFields.length ? '仍有信息需要你补充，发布前请逐项确认。' : '发布前请检查每个字段是否准确。', tone: 'success' })
    } catch (error) { toast({ title: '自动填写暂时不可用', description: safeErrorMessage(error, '你仍可以手动填写表单。'), tone: 'error' }) }
    finally { setAiLoading(false) }
  }

  async function submit(values: Values) {
    if (totalImages === 0) { setImageError('请至少上传一张真实商品图片。'); inputRef.current?.focus(); return }
    setImageError('')
    await onSubmit({ ...values, originalPrice: values.originalPrice ?? null }, newImages.map((item) => item.file), keepImageIds)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]" noValidate>
      <div className="grid gap-7">
        <section className="surface rounded-lg p-4 sm:p-5" aria-labelledby="images-title">
          <div className="flex items-end justify-between"><div><h2 id="images-title" className="text-sm font-semibold">商品图片</h2><p className="mt-1 text-xs text-muted-foreground">最多 5 张，第一张作为封面；支持 JPG、PNG、WebP，单张不超过 5 MB。</p></div><span className="text-xs text-muted-foreground">{totalImages}/{MAX_IMAGES}</span></div>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {keptImages.map((item, index) => <div key={item.id} className="relative aspect-square overflow-hidden rounded-md border border-border"><img src={item.url} alt={`商品图片 ${index + 1}`} className="h-full w-full object-cover" />{index === 0 ? <Badge className="absolute bottom-1 left-1 gap-1 bg-background/90"><Star className="h-3 w-3" />封面</Badge> : null}<button type="button" className="focus-ring absolute right-1 top-1 rounded-full bg-background/90 p-1" onClick={() => setKeepImageIds((ids) => ids.filter((id) => id !== item.id))} aria-label={`删除第 ${index + 1} 张图片`}><X className="h-4 w-4" /></button></div>)}
            {newImages.map((item, index) => { const order = keptImages.length + index; return <div key={item.url} className="relative aspect-square overflow-hidden rounded-md border border-border"><img src={item.url} alt={`新商品图片 ${order + 1}`} className="h-full w-full object-cover" />{order === 0 ? <Badge className="absolute bottom-1 left-1 gap-1 bg-background/90"><Star className="h-3 w-3" />封面</Badge> : null}<button type="button" className="focus-ring absolute right-1 top-1 rounded-full bg-background/90 p-1" onClick={() => removeNew(index)} aria-label={`删除第 ${order + 1} 张图片`}><X className="h-4 w-4" /></button></div> })}
            {totalImages < MAX_IMAGES ? <button type="button" className="focus-ring flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input text-xs text-muted-foreground hover:border-foreground/30 hover:bg-muted/40" onClick={() => inputRef.current?.click()}><ImagePlus className="h-5 w-5" />添加图片</button> : null}
          </div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => { selectImages(event.target.files); event.target.value = '' }} aria-label="选择商品图片" />
          {imageError ? <p className="mt-2 text-xs text-destructive" role="alert">{imageError}</p> : null}
        </section>

        <section className="surface rounded-lg p-4 sm:p-5" aria-labelledby="details-title">
          <h2 id="details-title" className="text-sm font-semibold">商品信息</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><FormField label="商品名称" htmlFor="product-title" required error={errors.title?.message}><Input id="product-title" {...register('title')} aria-invalid={Boolean(errors.title)} /></FormField></div>
            <FormField label="分类" htmlFor="product-category" required error={errors.category?.message}><Select id="product-category" {...register('category')}>{CATEGORY_OPTIONS.filter((item) => item.value !== 'all').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></FormField>
            <FormField label="成色" htmlFor="product-condition" required error={errors.condition?.message}><Select id="product-condition" {...register('condition')}>{CONDITION_OPTIONS.filter((item) => item.value !== 'all').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></FormField>
            <FormField label="售价" htmlFor="product-price" required error={errors.price?.message}><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">¥</span><Input id="product-price" className="pl-7" type="number" min="0" step="0.01" {...register('price', { valueAsNumber: true })} aria-invalid={Boolean(errors.price)} /></div></FormField>
            <FormField label="原价（可选）" htmlFor="product-original-price" error={errors.originalPrice?.message}><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">¥</span><Input id="product-original-price" className="pl-7" type="number" min="0" step="0.01" {...register('originalPrice')} aria-invalid={Boolean(errors.originalPrice)} /></div></FormField>
            <div className="sm:col-span-2"><FormField label="商品描述" htmlFor="product-description" required error={errors.description?.message} hint="如实说明功能、外观、缺陷和包含物品。"><Textarea id="product-description" rows={6} {...register('description')} aria-invalid={Boolean(errors.description)} /></FormField></div>
            <div className="sm:col-span-2"><FormField label="面交地点" htmlFor="product-location" required error={errors.location?.message} hint="请使用公共、容易找到的地点。"><Input id="product-location" {...register('location')} placeholder="例如：图书馆附近" aria-invalid={Boolean(errors.location)} /></FormField></div>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="surface rounded-lg p-4" aria-labelledby="ai-fill-title">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h2 id="ai-fill-title" className="text-sm font-semibold">辅助填写</h2></div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">写下你确定的信息。系统只会填入表单，不会替你发布。</p>
          <Textarea className="mt-3 min-h-32" value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder="例如：K380，用了一年，功能正常，100 元左右，宿舍楼下可面交" aria-label="原始商品描述" />
          <Button type="button" className="mt-3 w-full" variant="secondary" loading={aiLoading} onClick={() => void runAutofill()}>自动填写</Button>
          {aiMissing.length ? <div className="mt-3"><p className="text-xs text-muted-foreground">仍需补充</p><div className="mt-2 flex flex-wrap gap-1.5">{aiMissing.map((item) => <Badge key={item}>{item}</Badge>)}</div></div> : null}
        </section>
        <div className="surface rounded-lg p-4"><p className="text-sm font-medium">发布前确认</p><ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground"><li>· 图片与描述属于同一件商品</li><li>· 已如实说明影响使用的问题</li><li>· 面交时当面核对商品状态</li></ul><Button type="submit" className="mt-4 w-full" size="lg" loading={isSubmitting}>{product ? '保存修改' : '确认发布'}</Button></div>
      </aside>
    </form>
  )
}
