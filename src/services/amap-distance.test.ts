import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTimeout } from '@/services/amap-distance'

describe('AMap distance timeouts', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a completed map operation', async () => {
    await expect(withTimeout(Promise.resolve(320), 50, '超时')).resolves.toBe(320)
  })

  it('rejects a map operation that never settles', async () => {
    vi.useFakeTimers()
    const result = withTimeout(new Promise<number>(() => undefined), 100, '高德地图连接超时')
    const assertion = expect(result).rejects.toThrow('高德地图连接超时')
    await vi.advanceTimersByTimeAsync(100)
    await assertion
  })
})
