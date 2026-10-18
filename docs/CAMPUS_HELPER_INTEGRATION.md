# 闲置助手接入说明

## 当前状态

网页端已经接入一个独立的“闲置助手”页面，并通过本站的 Vercel Serverless Function 调用智能体。现有商品发布、AI 识图、搜索、交易和消息功能没有被替换或改写。

合作方交付的标准 FastAPI 工程已部署为扣子 API 服务。线上网关使用部署详情中生成的永久 API Token 调用正式 `/stream_run` 接口，Token 仅保存于 Vercel 服务端环境变量。

## 调用链

```text
已登录浏览器
  -> POST /api/campus-helper（携带 Supabase access token）
  -> Vercel 校验当前用户
  -> 扣子部署 /stream_run
  -> 仅把回答文本返回浏览器
```

浏览器不会获得智能体密钥、Supabase service-role key 或模型网关密钥。

## Vercel 环境变量

在 Vercel 项目的 Production、Preview（按需）环境中配置：

- `CAMPUS_HELPER_BASE_URL`：智能体部署后的 HTTPS 根地址，不要包含 `/stream_run`。
- `CAMPUS_HELPER_API_KEY`：在该项目的扣子部署详情中生成的 API Token。
- `CAMPUS_HELPER_PROJECT_ID`：扣子项目 ID，与项目 URL 和部署调用示例一致。
- `SUPABASE_URL`、`SUPABASE_ANON_KEY`：推荐使用服务端名称；未配置时网关会兼容现有 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。

这些变量均为服务端配置，**不要添加 `VITE_` 前缀**。保存后需要重新部署 Vercel。

## 智能体后端部署

指南提供两种方式：

1. 自有公网 Linux 服务器：运行 FastAPI，由 Nginx 提供 HTTPS，并在入口增加共享密钥或其他访问控制。
2. 发布到扣子平台：取得平台生成的 HTTPS 地址和鉴权方式。

无论选择哪一种，最终服务需要兼容：

```http
POST /stream_run
Content-Type: application/json
Authorization: Bearer <部署 API Token>
```

网关会先验证 Supabase 登录状态，再使用已验证用户的 ID 作为稳定 `session_id`，不接受浏览器伪造的会话 ID。请求按扣子部署页的 `content.query.prompt` 协议发送，回复从 SSE `answer` 事件中合并。

扣子会返回 `text/event-stream`，其中回答分片格式类似：

```text
event: message
data: {"type":"answer","content":{"answer":"回答分片"}}
```

后端运行所需的 `COZE_INTEGRATION_MODEL_BASE_URL`、`COZE_WORKLOAD_IDENTITY_API_KEY`、`COZE_SUPABASE_SERVICE_ROLE_KEY` 等敏感变量只放在后端托管环境，不能放入 Git 或 Vercel 前端变量。

## 数据安全边界

合作方源码中的商品工具使用独立的 `items` 数据结构和 Supabase service-role。当前网页使用的是 `products`、`product_images` 等现有结构，两者并不等价。为保证现有功能不受影响，本次只开放问答能力：

- 智能体不直接新增、修改或删除现有商品。
- 商品发布仍通过现有表单、校验与 Supabase RLS 完成。
- 如将来需要“对话生成发布草稿”，应先定义结构化草稿协议，再由用户确认后填入现有表单，不能让智能体用 service-role 直接入库。

## 上线验收

1. 后端 `/health` 可通过 HTTPS 访问。
2. 用测试账号登录网站，打开 `/assistant`。
3. 发送普通问答，确认返回内容正常。
4. 退出登录后直接调用 `/api/campus-helper`，应返回 401。
5. 临时填错后端地址，页面应显示可重试错误，其他页面仍可正常使用。
6. 确认浏览器网络面板和构建产物中不存在 service-role、模型或智能体密钥。
