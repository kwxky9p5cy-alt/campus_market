import { describe, expect, it, vi } from 'vitest'
import { createTimedFetch, DEFAULT_REQUEST_TIMEOUT_MS, parseRequestTimeout } from '@/lib/timed-fetch'

describe('timed fetch', () => {
  it('accepts bounded timeout configuration', () => {
    expect(parseRequestTimeout('5000')).toBe(5000)
    expect(parseRequestTimeout('200')).toBe(DEFAULT_REQUEST_TIMEOUT_MS)
    expect(parseRequestTimeout('not-a-number')).toBe(DEFAULT_REQUEST_TIMEOUT_MS)
  })

  it('returns successful responses unchanged', async () => {
    const response = new Response('ok', { status: 200 })
    const fetchImpl = vi.fn(async () => response) as unknown as typeof fetch

    await expect(createTimedFetch(fetchImpl, 1000)('https://example.test')).resolves.toBe(response)
  })

  it('turns a stalled request into a recoverable timeout', async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })) as unknown as typeof fetch

    await expect(createTimedFetch(fetchImpl, 5)('https://example.test')).rejects.toMatchObject({
      code: 'request-timeout',
      retryable: true,
    })
  })

  it('preserves an upstream cancellation', async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })) as unknown as typeof fetch
    const controller = new AbortController()
    controller.abort()

    await expect(createTimedFetch(fetchImpl, 1000)('https://example.test', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
