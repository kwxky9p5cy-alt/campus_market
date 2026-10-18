import { describe, expect, it } from 'vitest'
import { isExistingEmailSignup } from '@/services/supabase-service'

describe('Supabase registration duplicate detection', () => {
  it('recognizes Supabase obfuscated duplicate signup responses', () => {
    expect(isExistingEmailSignup({ identities: [] })).toBe(true)
  })

  it('does not reject a new identity', () => {
    expect(isExistingEmailSignup({ identities: [{ id: 'identity-1' }] })).toBe(false)
    expect(isExistingEmailSignup(null)).toBe(false)
  })
})
