import { describe, expect, it } from 'vitest'
import { fallbackParseSearch } from '@/services/ai/searchParser'
import { fallbackAutofill, parseAutofillResponse } from '@/services/ai/autofill'

describe('search parser fallback', () => {
  it('parses keyboard, max price and condition', () => {
    expect(fallbackParseSearch({ text: '我想找300块以内成色比较好的机械键盘' })).toMatchObject({ keywords: ['机械键盘'], category: 'digital', priceMax: 300, condition: 'good' })
  })
  it('parses inexpensive lamp', () => {
    expect(fallbackParseSearch({ text: '50块以下的台灯' })).toMatchObject({ keywords: ['台灯'], category: 'life', priceMax: 50 })
  })
  it('parses a textbook query without inventing price', () => {
    expect(fallbackParseSearch({ text: '想找一本教材' })).toMatchObject({ keywords: ['教材'], category: 'books', priceMax: null })
  })
})

describe('autofill fallback', () => {
  it('extracts only facts present in the description', () => {
    const result = fallbackAutofill({ rawText: 'K380，用了一年，功能正常，因为换机械键盘所以不用了，100左右，宿舍楼下可以面交' })
    expect(result).toMatchObject({ title: 'K380', category: 'digital', price: 100, condition: 'good', location: '宿舍楼下面交' })
    expect(result.description).not.toContain('保修')
  })
  it('marks missing information instead of fabricating it', () => {
    const result = fallbackAutofill({ rawText: '一个闲置物品' })
    expect(result.price).toBeNull()
    expect(result.missingFields).toContain('售价')
    expect(result.imageInsights).toEqual({
      productObjects: [], visibleText: [], colors: [], materials: [], distinguishingFeatures: [],
      brandCandidates: [], conditionNotes: [], conditionConfidence: 'none',
    })
  })
})

describe('autofill provider response', () => {
  it('normalizes unknown nullable text fields returned by a compatible provider', () => {
    const result = parseAutofillResponse({
      title: '罗技 K380 绿色无线键盘',
      category: 'digital',
      price: null,
      condition: null,
      description: '绿色无线键盘',
      location: null,
      tags: ['罗技', 'K380'],
      missingFields: ['售价', '成色', '交易地点'],
      imageInsights: {
        productObjects: ['无线键盘'],
        visibleText: ['LOGITECH K380'],
        colors: ['绿色'],
        materials: ['塑料'],
        distinguishingFeatures: ['圆形键帽'],
        brandCandidates: [{ name: '罗技', evidence: '机身文字 LOGITECH', confidence: 'high' }],
        conditionNotes: [],
        conditionConfidence: 'none',
      },
      research: {
        status: 'available', query: '罗技 K380 二手价格', identifiedBrand: '罗技', identifiedProduct: 'K380 无线键盘',
        confidence: 'high', summary: '公开结果与图片文字一致。', priceLow: 70, priceHigh: 110, suggestedPrice: 90,
        rationale: '根据同型号二手商品公开价格，并保留成色差异。', sources: [{ title: '示例来源', url: 'https://example.com/k380' }],
      },
    })

    expect(result.location).toBe('')
    expect(result.research.suggestedPrice).toBe(90)
  })
})
