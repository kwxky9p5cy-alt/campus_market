// Supabase Edge Function: server-only adapter for an OpenAI-compatible JSON API.
// Deploy with: supabase functions deploy ai-assistant --no-verify-jwt=false
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const searchPrompt = `你是校园二手市场的搜索条件解析器。只理解用户需求，不生成或推荐商品。输出严格 JSON：{"keywords":string[],"category":"digital"|"books"|"life"|"sports"|"other"|null,"priceMin":number|null,"priceMax":number|null,"condition":"new"|"like_new"|"good"|"fair"|null}。不确定则为 null 或空数组，不得虚构数据库中的商品。`
const autofillPrompt = `你是校园二手商品表单助手。只能提取用户文字中明确存在的事实，不得猜测购买日期、原价、保修、维修史、缺陷、配件、品牌型号。输出严格 JSON：{"title":string,"category":"digital"|"books"|"life"|"sports"|"other"|null,"price":number|null,"condition":"new"|"like_new"|"good"|"fair"|null,"description":string,"location":string,"tags":string[],"missingFields":string[]}。不确定字段留空或 null。你只填写草稿，绝不执行发布。`

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const providerUrl = Deno.env.get('AI_PROVIDER_URL')
    const apiKey = Deno.env.get('AI_PROVIDER_API_KEY')
    const model = Deno.env.get('AI_PROVIDER_MODEL')
    if (!providerUrl || !apiKey || !model) return Response.json({ error: 'AI provider not configured' }, { status: 503, headers: cors })

    const body = await request.json() as { task?: 'search' | 'autofill'; input?: unknown }
    if (!body.task || !body.input) return Response.json({ error: 'Invalid request' }, { status: 400, headers: cors })
    const system = body.task === 'search' ? searchPrompt : autofillPrompt
    const response = await fetch(providerUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, response_format: { type: 'json_object' }, temperature: 0, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(body.input) }] }),
    })
    if (!response.ok) return Response.json({ error: 'Provider request failed' }, { status: 502, headers: cors })
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = result.choices?.[0]?.message?.content
    if (!content) return Response.json({ error: 'Empty provider response' }, { status: 502, headers: cors })
    return new Response(content.replace(/^```json\s*|\s*```$/g, ''), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch {
    return Response.json({ error: 'AI request failed' }, { status: 500, headers: cors })
  }
})
