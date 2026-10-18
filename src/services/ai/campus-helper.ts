import { z } from 'zod'
import { supabase } from '@/lib/supabase'

export type CampusHelperRole = 'user' | 'assistant'

export interface CampusHelperMessage {
  role: CampusHelperRole
  content: string
}

const responseSchema = z.object({ message: z.string().trim().min(1) })
const errorSchema = z.object({ error: z.string().trim().min(1) })

export function parseCampusHelperResponse(value: unknown) {
  return responseSchema.parse(value).message
}

export async function askCampusHelper(messages: CampusHelperMessage[], signal?: AbortSignal) {
  if (!supabase) throw new Error('闲置助手仅在连接真实服务后可用。')
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('登录状态已失效，请重新登录。')

  const response = await fetch('/api/campus-helper', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ messages }),
    signal,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const parsed = errorSchema.safeParse(payload)
    throw new Error(parsed.success ? parsed.data.error : '闲置助手暂时无法响应，请稍后重试。')
  }
  const parsed = responseSchema.safeParse(payload)
  if (!parsed.success) throw new Error('闲置助手返回了无法识别的内容，请重试。')
  return parsed.data.message
}
