import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { ProductCategory, ProductCondition } from '@/types/domain'
import type { SearchParseInput, SearchParseResult } from '@/services/ai/types'

const schema = z.object({
  keywords: z.array(z.string().min(1)).max(6),
  category: z.enum(['digital', 'books', 'life', 'sports', 'other']).nullable(),
  priceMin: z.number().nonnegative().nullable(),
  priceMax: z.number().nonnegative().nullable(),
  condition: z.enum(['new', 'like_new', 'good', 'fair']).nullable(),
})

const categoryTerms: Record<ProductCategory, string[]> = {
  digital: ['数码', '机械键盘', '蓝牙键盘', '键盘', '鼠标', '耳机', '电脑', '显示器', '相机', '平板', '手机', '路由器', '充电器', '音箱'],
  books: ['教材', '课本', '书', '考研', '词典', '小说', '资料'],
  life: ['生活', '台灯', '风扇', '收纳', '衣架', '水杯', '宿舍', '桌椅'],
  sports: ['运动', '自行车', '羽毛球', '球拍', '篮球', '足球', '瑜伽', '哑铃'],
  other: ['其他', '计算器', '文具', '票'],
}

const productTerms = [...new Set(Object.values(categoryTerms).flat().filter((term) => !['数码', '生活', '运动', '其他', '宿舍'].includes(term)))].sort((a, b) => b.length - a.length)

function detectCategory(text: string): ProductCategory | null {
  let best: { category: ProductCategory; count: number } | null = null
  for (const [category, terms] of Object.entries(categoryTerms) as Array<[ProductCategory, string[]]>) {
    const count = terms.filter((term) => text.includes(term)).length
    if (count && (!best || count > best.count)) best = { category, count }
  }
  return best?.category ?? null
}

function detectCondition(text: string): ProductCondition | null {
  if (/全新|未拆|没用过/.test(text)) return 'new'
  if (/几乎全新|近全新|九[成9]新|很新|成色新/.test(text)) return 'like_new'
  if (/成色(?:比较)?(?:好|较好)|八[成8]新|功能正常|正常使用/.test(text)) return 'good'
  if (/有使用痕迹|成色一般|旧一些|不介意旧|划痕/.test(text)) return 'fair'
  return null
}

function detectPrices(text: string) {
  const range = text.match(/(\d+(?:\.\d+)?)\s*(?:元|块)?\s*(?:到|至|[-~—])\s*(\d+(?:\.\d+)?)\s*(?:元|块)?/)
  if (range) return { priceMin: Number(range[1]), priceMax: Number(range[2]) }
  const max = text.match(/(\d+(?:\.\d+)?)\s*(?:元|块)?\s*(?:以内|以下|之内|封顶)|(?:不超过|最多|预算)\s*(\d+(?:\.\d+)?)/)
  const min = text.match(/(\d+(?:\.\d+)?)\s*(?:元|块)?\s*(?:以上|起)|(?:至少|不低于)\s*(\d+(?:\.\d+)?)/)
  return { priceMin: min ? Number(min[1] ?? min[2]) : null, priceMax: max ? Number(max[1] ?? max[2]) : null }
}

export function fallbackParseSearch({ text }: SearchParseInput): SearchParseResult {
  const normalized = text.trim().toLowerCase()
  const category = detectCategory(normalized)
  const condition = detectCondition(normalized)
  const prices = detectPrices(normalized)
  const matchedTerms = productTerms.filter((term) => normalized.includes(term))
  let keywords = matchedTerms.filter((term) => !matchedTerms.some((other) => other !== term && other.includes(term)))
  if (!keywords.length) {
    const cleaned = normalized
      .replace(/\d+(?:\.\d+)?\s*(?:元|块)?\s*(?:以内|以下|以上|之内|封顶|起)?/g, ' ')
      .replace(/我想|想找|帮我找|有没有|求购|预算|价格|一个|一台|一本|比较|成色|新的|较好|全新|可以|左右|不超过|最多|至少/g, ' ')
      .replace(/[，。！？,.!?]/g, ' ')
    keywords = cleaned.split(/\s+/).filter((word) => word.length >= 2).slice(0, 3)
  }
  return { keywords, category, condition, ...prices, source: 'fallback' }
}

export async function parseSearch(input: SearchParseInput): Promise<SearchParseResult> {
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', { body: { task: 'search', input } })
      if (!error) return { ...schema.parse(data), source: 'provider' }
    } catch { /* A missing provider should not block search. */ }
  }
  return fallbackParseSearch(input)
}
