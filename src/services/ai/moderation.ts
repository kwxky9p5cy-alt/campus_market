import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { AutofillInput, ModerationCategory, ModerationResult } from '@/services/ai/types'

const categories = [
  'none',
  'firearms_explosives',
  'drugs_controlled_substances',
  'controlled_weapons',
  'hazardous_materials',
  'protected_wildlife',
  'stolen_smuggled_property',
  'classified_military_police',
] as const

const schema = z.object({
  status: z.enum(['allowed', 'blocked', 'review']),
  category: z.enum(categories),
  reason: z.string().max(240),
  evidence: z.array(z.string().max(120)).max(6),
  confidence: z.enum(['high', 'medium', 'low']),
})

interface LocalRule {
  category: Exclude<ModerationCategory, 'none'>
  pattern: RegExp
  reason: string
}

const localRules: LocalRule[] = [
  {
    category: 'firearms_explosives',
    pattern: /手枪|步枪|猎枪|气枪|火药枪|仿真枪|水弹枪|冷媒枪|射钉枪|枪管|弹匣|子弹|弹药|火药|炸药|爆炸物|雷管|手榴弹/i,
    reason: '该商品涉及枪支、弹药、爆炸物或相关器件，属于平台禁止交易的一类高危物品。',
  },
  {
    category: 'drugs_controlled_substances',
    pattern: /毒品|海洛因|冰毒|甲基苯丙胺|可卡因|吗啡|芬太尼|摇头丸|麻古|易制毒化学品|吸毒工具|麻醉药品|精神类管制药品/i,
    reason: '该商品涉及毒品、受管制药品、相关原料或吸食工具，平台禁止交易。',
  },
  {
    category: 'controlled_weapons',
    pattern: /弹簧刀|三棱刮刀|三棱刀|匕首|警用甩棍|电击器|电棍|弓弩|弩箭|杀伤(?:性)?飞镖/i,
    reason: '该商品涉及管制器具或具有明显杀伤性的改装器械，平台禁止交易。',
  },
  {
    category: 'hazardous_materials',
    pattern: /放射性物品|剧毒化学品|汽油|烟花|高压气瓶|易燃易爆危险品/i,
    reason: '该商品涉及放射性、剧毒、易燃易爆或高压危险品，平台禁止交易。',
  },
  {
    category: 'protected_wildlife',
    pattern: /象牙|玳瑁|犀牛角|穿山甲|虎皮|野生鸟类标本|保护野生动物|保护野生植物|无\s*CITES.*鳄鱼皮/i,
    reason: '该商品可能涉及国家保护野生动植物或其制品，平台禁止交易。',
  },
  {
    category: 'stolen_smuggled_property',
    pattern: /赃物|盗抢物品|偷来(?:的)?|抢来(?:的)?|走私货|抵押物品|查封物品|来历不明物品/i,
    reason: '该商品被描述为赃物、盗抢物品、走私货或受限制处置的财物，平台禁止交易。',
  },
  {
    category: 'classified_military_police',
    pattern: /国家涉密|涉密资料|涉密设备|警徽|警号|军官证|军警制式服装|警用装备|军警装备/i,
    reason: '该商品涉及涉密资料、涉密设备或军警专用标识与装备，平台禁止交易。',
  },
]

export function scanProhibitedText(text: string): ModerationResult {
  const match = localRules.find((rule) => rule.pattern.test(text))
  if (!match) {
    return { status: 'allowed', category: 'none', reason: '', evidence: [], confidence: 'low', source: 'local' }
  }
  return {
    status: 'blocked',
    category: match.category,
    reason: match.reason,
    evidence: [],
    confidence: 'high',
    source: 'local',
  }
}

export function parseModerationResponse(data: unknown): ModerationResult {
  return { ...schema.parse(data), source: 'provider' }
}

export async function moderateProduct(input: AutofillInput): Promise<ModerationResult> {
  const local = scanProhibitedText(input.rawText)
  if (local.status === 'blocked') return local
  if (!supabase) throw new Error('商品安全检查服务尚未配置，暂时无法发布。')

  const { data, error } = await supabase.functions.invoke('ai-assistant', { body: { task: 'moderate', input } })
  if (error) throw new Error('商品安全检查暂时不可用，请稍后重试。')
  return parseModerationResponse(data)
}
