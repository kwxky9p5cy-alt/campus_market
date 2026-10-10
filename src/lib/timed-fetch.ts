import { ServiceError } from '@/lib/service-error'

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

export function parseRequestTimeout(value?: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1_000 && parsed <= 60_000
    ? parsed
    : DEFAULT_REQUEST_TIMEOUT_MS
}

export function createTimedFetch(fetchImpl: typeof fetch, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): typeof fetch {
  return async (input, init = {}) => {
    const controller = new AbortController()
    const upstreamSignal = init.signal
    let timedOut = false

    if (upstreamSignal?.aborted) {
      throw upstreamSignal.reason instanceof Error
        ? upstreamSignal.reason
        : new DOMException('Aborted', 'AbortError')
    }

    const forwardAbort = () => controller.abort(upstreamSignal?.reason)
    upstreamSignal?.addEventListener('abort', forwardAbort, { once: true })

    const timer = globalThis.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      return await fetchImpl(input, { ...init, signal: controller.signal })
    } catch (error) {
      if (timedOut) throw new ServiceError('request-timeout', '连接服务超时，请检查网络后重试。', true)
      throw error
    } finally {
      globalThis.clearTimeout(timer)
      upstreamSignal?.removeEventListener('abort', forwardAbort)
    }
  }
}
