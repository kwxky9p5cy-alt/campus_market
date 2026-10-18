import { describe, expect, it } from 'vitest'
import { parseCampusHelperResponse } from '@/services/ai/campus-helper'

describe('campus helper response', () => {
  it('reads a valid assistant message', () => {
    expect(parseCampusHelperResponse({ message: '可以先拍摄商品正面和铭牌。' })).toBe('可以先拍摄商品正面和铭牌。')
  })

  it('rejects empty or unexpected payloads', () => {
    expect(() => parseCampusHelperResponse({ message: '  ' })).toThrow()
    expect(() => parseCampusHelperResponse({ choices: [] })).toThrow()
  })
})
