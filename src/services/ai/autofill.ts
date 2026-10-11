import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { scanProhibitedText } from '@/services/ai/moderation'
import type { ProductCategory, ProductCondition } from '@/types/domain'
import type { AutofillInput, AutofillResult } from '@/services/ai/types'

const schema = z.object({
  title: z.string().max(80).nullish().transform((value) => value ?? ''),
  category: z.enum(['digital', 'books', 'life', 'sports', 'other']).nullable(),
  price: z.number().nonnegative().nullable(),
  condition: z.enum(['new', 'like_new', 'good', 'fair']).nullable(),
  description: z.string().max(2000).nullish().transform((value) => value ?? ''),
  location: z.string().max(80).nullish().transform((value) => value ?? ''),
  tags: z.array(z.string()).max(8),
  missingFields: z.array(z.string()),
  imageInsights: z.object({
    productObjects: z.array(z.string().max(80)).max(8),
    visibleText: z.array(z.string().max(120)).max(12),
    colors: z.array(z.string().max(40)).max(8),
    materials: z.array(z.string().max(60)).max(8),
    distinguishingFeatures: z.array(z.string().max(120)).max(8),
    brandCandidates: z.array(z.object({
      name: z.string().max(80),
      evidence: z.string().max(160),
      confidence: z.enum(['high', 'medium', 'low']),
    })).max(5),
    conditionNotes: z.array(z.string().max(120)).max(8),
    conditionConfidence: z.enum(['high', 'medium', 'low', 'none']),
  }),
  research: z.object({
    status: z.enum(['available', 'insufficient', 'unavailable']),
    query: z.string().max(160),
    identifiedBrand: z.string().max(80),
    identifiedProduct: z.string().max(120),
    confidence: z.enum(['high', 'medium', 'low', 'none']),
    summary: z.string().max(500),
    priceLow: z.number().nonnegative().nullable(),
    priceHigh: z.number().nonnegative().nullable(),
    suggestedPrice: z.number().nonnegative().nullable(),
    rationale: z.string().max(500),
    sources: z.array(z.object({ title: z.string().max(160), url: z.string().url().max(1000) })).max(5),
  }),
  moderation: z.object({
    status: z.enum(['allowed', 'blocked', 'review']),
    category: z.enum(['none', 'firearms_explosives', 'drugs_controlled_substances', 'controlled_weapons', 'hazardous_materials', 'protected_wildlife', 'stolen_smuggled_property', 'classified_military_police']),
    reason: z.string().max(240),
    evidence: z.array(z.string().max(120)).max(6),
    confidence: z.enum(['high', 'medium', 'low']),
  }),
})

export function parseAutofillResponse(data: unknown) {
  return schema.parse(data)
}

const categoryRules: Array<[ProductCategory, RegExp]> = [
  ['digital', /键盘|鼠标|耳机|电脑|显示器|相机|平板|手机|路由器|充电|音箱|k\d+/i],
  ['books', /教材|课本|书|考研|词典|小说|资料/],
  ['life', /台灯|风扇|收纳|衣架|水杯|桌|椅|宿舍用品/],
  ['sports', /自行车|羽毛球|球拍|篮球|足球|瑜伽|哑铃/],
  ['other', /计算器|文具/],
]

function findCategory(text: string): ProductCategory | null {
  return categoryRules.find(([, rule]) => rule.test(text))?.[0] ?? null
}

function findCondition(text: string): ProductCondition | null {
  if (/全新|没用过|未拆/.test(text)) return 'new'
  if (/九成新|几乎全新|很新|没怎么用/.test(text)) return 'like_new'
  if (/功能正常|正常使用|成色好|八成新|用[了过]/.test(text)) return 'good'
  if (/划痕|磕碰|使用痕迹|比较旧/.test(text)) return 'fair'
  return null
}

function findPrice(text: string) {
  const explicit = text.match(/(?:卖|出|价格|售价|想卖|大概)?\s*(\d+(?:\.\d+)?)\s*(?:元|块|左右)/)
  return explicit ? Number(explicit[1]) : null
}

function findLocation(text: string) {
  const known = text.match(/(宿舍(?:楼下|区)?|图书馆(?:附近|门口)?|食堂(?:门口|附近)?|体育馆(?:附近|门口)?|教学楼(?:附近|门口)?|校园内)(?:可以|可)?面交?/)
  if (known) return known[1].includes('面交') ? known[1] : `${known[1]}面交`
  return /面交/.test(text) ? '校园内面交' : ''
}

function makeTitle(text: string) {
  const first = text.split(/[，。,.！!？?；;]/)[0].trim()
  return first.replace(/^(出|出售|闲置|转让)\s*/, '').slice(0, 36)
}

export function fallbackAutofill({ rawText }: AutofillInput): AutofillResult {
  const text = rawText.trim()
  const category = findCategory(text)
  const price = findPrice(text)
  const condition = findCondition(text)
  const location = findLocation(text)
  const title = makeTitle(text)
  const missingFields = [!title && '商品名称', !category && '分类', price == null && '售价', !condition && '成色', !location && '交易地点'].filter(Boolean) as string[]
  const tags = categoryRules.flatMap(([, rule]) => text.match(rule)?.[0] ?? []).slice(0, 5)
  return {
    title,
    category,
    price,
    condition,
    description: text,
    location,
    tags: [...new Set(tags)],
    missingFields,
    imageInsights: {
      productObjects: [], visibleText: [], colors: [], materials: [], distinguishingFeatures: [],
      brandCandidates: [], conditionNotes: [], conditionConfidence: 'none',
    },
    research: {
      status: 'unavailable', query: '', identifiedBrand: '', identifiedProduct: '', confidence: 'none',
      summary: '', priceLow: null, priceHigh: null, suggestedPrice: null, rationale: '', sources: [],
    },
    moderation: scanProhibitedText(text),
    source: 'fallback',
  }
}

export async function autofillProduct(input: AutofillInput): Promise<AutofillResult> {
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', { body: { task: 'autofill', input } })
      if (!error) {
        const parsed = parseAutofillResponse(data)
        return { ...parsed, moderation: { ...parsed.moderation, source: 'provider' }, source: 'provider' }
      }
    } catch { /* Keep the editable rule-based form available. */ }
  }
  return fallbackAutofill(input)
}
