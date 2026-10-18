export type ServiceErrorCode =
  | 'service-unavailable'
  | 'request-timeout'
  | 'invalid-credentials'
  | 'email-unconfirmed'
  | 'rate-limited'
  | 'profile-unavailable'
  | 'unknown'

export class ServiceError extends Error {
  readonly code: ServiceErrorCode
  readonly retryable: boolean

  constructor(code: ServiceErrorCode, message: string, retryable = false) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.retryable = retryable
  }
}

function errorDetails(error: unknown) {
  if (!error || typeof error !== 'object') return { name: '', message: String(error ?? ''), code: '', status: 0 }
  const value = error as { name?: unknown; message?: unknown; code?: unknown; status?: unknown }
  return {
    name: typeof value.name === 'string' ? value.name : '',
    message: typeof value.message === 'string' ? value.message : '',
    code: typeof value.code === 'string' ? value.code : '',
    status: typeof value.status === 'number' ? value.status : 0,
  }
}

export function isTimeoutFailure(error: unknown) {
  if (error instanceof ServiceError) return error.code === 'request-timeout'
  const { name, message, code } = errorDetails(error)
  return name === 'TimeoutError'
    || code === 'ETIMEDOUT'
    || /timed?\s*out|timeout|aborted due to timeout/i.test(message)
}

export function isConnectivityFailure(error: unknown) {
  if (error instanceof ServiceError) return ['service-unavailable', 'request-timeout'].includes(error.code)
  const { name, message, code, status } = errorDetails(error)
  return status === 0
    || status >= 500
    || name === 'AuthRetryableFetchError'
    || ['ECONNRESET', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code)
    || /failed to fetch|fetch failed|network(?: request)? failed|load failed|networkerror|connection (?:reset|refused)|ssl|tls/i.test(message)
}

export type AuthOperation = 'session' | 'sign-in' | 'sign-up' | 'password-reset' | 'password-update' | 'profile'

export function toAuthServiceError(error: unknown, operation: AuthOperation) {
  if (error instanceof ServiceError) return error
  const { message, status } = errorDetails(error)

  if (isTimeoutFailure(error)) {
    return new ServiceError('request-timeout', '连接账号服务超时，请检查网络后重试。', true)
  }
  if (isConnectivityFailure(error)) {
    return new ServiceError('service-unavailable', '暂时无法连接账号服务，请检查网络后重试。', true)
  }
  if (/email not confirmed/i.test(message)) {
    return new ServiceError('email-unconfirmed', '邮箱尚未完成验证，请先查看验证邮件。')
  }
  if (/rate limit|too many requests|request rate/i.test(message) || status === 429) {
    return new ServiceError('rate-limited', '尝试次数过多，请稍后再试。', true)
  }
  if (operation === 'sign-in' && (/invalid login credentials|invalid.*(?:password|credentials)/i.test(message) || status === 400)) {
    return new ServiceError('invalid-credentials', '邮箱或密码不正确。')
  }
  if (operation === 'profile') {
    return new ServiceError('profile-unavailable', '账号已登录，但个人资料暂时无法读取，请稍后重试。', true)
  }

  const fallback = operation === 'sign-up'
    ? '注册失败，请检查信息后重试。'
    : operation === 'password-reset'
      ? '暂时无法发送重置邮件，请稍后重试。'
      : operation === 'password-update'
        ? '密码更新失败，请重新打开邮件中的链接后再试。'
        : operation === 'session'
          ? '暂时无法确认登录状态，请重试。'
          : '登录失败，请稍后重试。'
  return new ServiceError('unknown', fallback, true)
}

export function toMarketplaceServiceError(error: unknown, fallback: string) {
  if (error instanceof ServiceError) return error
  if (isTimeoutFailure(error)) {
    return new ServiceError('request-timeout', '连接服务超时，请检查网络后重试。', true)
  }
  if (isConnectivityFailure(error)) {
    return new ServiceError('service-unavailable', '暂时无法连接校园集市服务，请检查网络后重试。', true)
  }
  return new ServiceError('unknown', fallback)
}
