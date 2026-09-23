import { describe, expect, it } from 'vitest'
import { fallbackParseSearch } from '@/services/ai/searchParser'
import { fallbackAutofill } from '@/services/ai/autofill'

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
  })
})
