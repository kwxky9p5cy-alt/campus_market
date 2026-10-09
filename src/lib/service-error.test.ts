import { describe, expect, it } from 'vitest'
import { ServiceError, toAuthServiceError, toMarketplaceServiceError } from '@/lib/service-error'

describe('service error translation', () => {
  it('keeps connectivity failures distinct from invalid credentials', () => {
    const error = toAuthServiceError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }, 'sign-in')

    expect(error).toBeInstanceOf(ServiceError)
    expect(error).toMatchObject({ code: 'service-unavailable', retryable: true })
    expect(error.message).toContain('无法连接账号服务')
  })

  it('maps rejected credentials without exposing backend details', () => {
    const error = toAuthServiceError({ message: 'Invalid login credentials', status: 400 }, 'sign-in')

    expect(error).toMatchObject({ code: 'invalid-credentials', retryable: false })
    expect(error.message).toBe('邮箱或密码不正确。')
  })

  it('explains email confirmation and rate limiting separately', () => {
    expect(toAuthServiceError({ message: 'Email not confirmed', status: 400 }, 'sign-in').code).toBe('email-unconfirmed')
    expect(toAuthServiceError({ message: 'Too many requests', status: 429 }, 'sign-in').code).toBe('rate-limited')
  })

  it('uses a consistent marketplace outage message', () => {
    const error = toMarketplaceServiceError(new TypeError('Failed to fetch'), '商品加载失败。')

    expect(error).toMatchObject({ code: 'service-unavailable', retryable: true })
    expect(error.message).toContain('校园集市服务')
  })

  it('preserves safe operation-specific fallback copy', () => {
    const error = toMarketplaceServiceError({ message: 'permission denied', status: 403 }, '商品删除失败，请重试。')

    expect(error).toMatchObject({ code: 'unknown', retryable: false })
    expect(error.message).toBe('商品删除失败，请重试。')
  })
})
