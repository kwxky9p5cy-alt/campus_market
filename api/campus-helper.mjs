const MAX_MESSAGES = 20
const MAX_MESSAGE_LENGTH = 4000
const UPSTREAM_TIMEOUT_MS = 55_000

function json(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

function getBearerToken(request) {
  const header = request.headers.authorization
  return typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : ''
}

function readSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  }
}

function parseMessages(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null
  const parsed = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    if (item.role !== 'user' && item.role !== 'assistant') return null
    if (typeof item.content !== 'string') return null
    const content = item.content.trim()
    if (!content || content.length > MAX_MESSAGE_LENGTH) return null
    parsed.push({ role: item.role, content })
  }
  return parsed
}

function buildUpstreamUrl(baseUrl) {
  let url
  try {
    url = new URL(baseUrl)
  } catch {
    return null
  }
  const localDevelopment = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  if (url.protocol !== 'https:' && !(localDevelopment && url.protocol === 'http:')) return null
  url.pathname = `${url.pathname.replace(/\/$/, '')}/stream_run`
  url.search = ''
  url.hash = ''
  return url
}

async function verifySupabaseUser(accessToken, signal) {
  const { url, anonKey } = readSupabaseConfig()
  if (!url || !anonKey) throw new Error('SUPABASE_NOT_CONFIGURED')
  const authUrl = new URL('/auth/v1/user', url)
  const response = await fetch(authUrl, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    signal,
  })
  if (!response.ok) return null
  const user = await response.json().catch(() => null)
  return typeof user?.id === 'string' && user.id ? user.id : null
}

function latestUserMessage(messages) {
  return messages.findLast((message) => message.role === 'user')?.content || ''
}

export function extractStreamAnswer(body) {
  let answer = ''
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue
    const raw = line.slice('data:'.length).trim()
    if (!raw || raw === '[DONE]') continue
    try {
      const event = JSON.parse(raw)
      const fragment = event?.content?.answer
      if (event?.type === 'answer' && typeof fragment === 'string') answer += fragment
    } catch {
      // Ignore non-JSON heartbeats and continue reading valid SSE events.
    }
  }
  return answer.trim()
}

function buildStreamBody(messages, userId) {
  const projectId = process.env.CAMPUS_HELPER_PROJECT_ID?.trim()
  if (!projectId || !/^\d+$/.test(projectId)) return null
  const payload = JSON.stringify({
    content: {
      query: {
        prompt: [{ type: 'text', content: { text: latestUserMessage(messages) } }],
      },
    },
    type: 'query',
    session_id: userId,
  })
  // Coze documents project_id as an integer. Keep the exact 19-digit value
  // instead of passing it through JavaScript's imprecise Number type.
  return `${payload.slice(0, -1)},"project_id":${projectId}}`
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return json(response, 405, { error: '仅支持 POST 请求。' })
  }

  const accessToken = getBearerToken(request)
  if (!accessToken) return json(response, 401, { error: '请先登录后再使用闲置助手。' })

  const messages = parseMessages(request.body?.messages)
  if (!messages) return json(response, 400, { error: '消息格式不正确，或内容过长。' })

  const upstreamUrl = buildUpstreamUrl(process.env.CAMPUS_HELPER_BASE_URL || '')
  if (!upstreamUrl) {
    return json(response, 503, { error: '闲置助手后端尚未完成部署，请稍后再试。' })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const userId = await verifySupabaseUser(accessToken, controller.signal)
    if (!userId) return json(response, 401, { error: '登录状态已失效，请重新登录。' })

    const headers = { 'Content-Type': 'application/json' }
    const upstreamKey = process.env.CAMPUS_HELPER_API_KEY?.trim()
    if (upstreamKey) headers.Authorization = `Bearer ${upstreamKey}`

    const upstreamBody = buildStreamBody(messages, userId)
    if (!upstreamBody) {
      return json(response, 503, { error: '闲置助手后端配置不完整，请稍后再试。' })
    }

    headers.Accept = 'text/event-stream'
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: upstreamBody,
      signal: controller.signal,
    })

    const payload = await upstream.text()
    if (!upstream.ok) {
      console.error('Campus helper upstream error', upstream.status)
      return json(response, 502, { error: '闲置助手暂时无法响应，请稍后重试。' })
    }

    const message = extractStreamAnswer(payload)
    if (!message) return json(response, 502, { error: '闲置助手返回了无法识别的内容，请重试。' })
    return json(response, 200, { message })
  } catch (error) {
    if (error?.name === 'AbortError') return json(response, 504, { error: '闲置助手响应超时，请稍后重试。' })
    console.error('Campus helper gateway error', error instanceof Error ? error.message : 'unknown')
    return json(response, 502, { error: '闲置助手连接失败，请稍后重试。' })
  } finally {
    clearTimeout(timer)
  }
}
