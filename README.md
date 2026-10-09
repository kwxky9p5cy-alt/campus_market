# Campus Market / 校园集市

一个面向学生真实使用场景的校园二手交易 MVP。首页直接展示商品，支持认证、发布与图片、普通/智能搜索、收藏、正式交易请求、状态流转、站内聊天和个人内容管理。项目不代表任何大学官方，也不包含在线支付或物流。

## 技术栈

- React 18、TypeScript、Vite、React Router
- Tailwind CSS、本地 shadcn 风格组件、Radix UI、Lucide
- React Hook Form、Zod
- Supabase Auth、PostgreSQL、Storage、Realtime、RLS、Edge Functions
- Vitest、ESLint

## 功能

- 邮箱注册、登录、退出、Session persistence、受保护路由
- 商品浏览、详情、发布、编辑、删除、上下架、预订、售出
- 最多 5 张图片预览与删除；类型和 5 MB 大小双层限制
- URL 可分享的关键词、分类、价格、成色、状态和排序筛选
- 自然语言智能检索；解析条件可见、可删除、可修改
- 商品描述辅助填写；结果始终可编辑，AI 不会直接发布
- 数据库收藏与即时反馈
- 交易请求的创建、接受、拒绝、取消、完成
- 商品 `reserved` / `sold` 状态联动
- 基础文本聊天、消息持久化、已读时间和 Realtime 插入监听
- 我的资料、发布、收藏、交易和消息
- 响应式桌面/手机布局，以及加载、空、错误、禁用和确认状态

## 本地运行

需要 Node.js 20+。

```bash
npm install
cp .env.example .env.local
npm run dev
```

不填写环境变量时，应用自动进入功能完整的浏览器演示模式。演示账号：

```text
demo@campus.market
demo1234
```

演示模式数据保存在当前浏览器的 `localStorage`，适合第一次查看 UI 和核心流程；它不是多设备共享数据库。

## 环境变量

浏览器变量写入 `.env.local`：

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_REQUEST_TIMEOUT_MS=12000
```

`anon` key 可以放在浏览器，但必须保留本项目 RLS。不要将 `service_role` 或 AI Key 加上 `VITE_` 前缀。

`VITE_REQUEST_TIMEOUT_MS` 可选，范围为 1000–60000 毫秒。真实服务不可达时，应用会显示可恢复的网络错误，不会自动切换到演示数据，以免真实数据与浏览器本地数据混淆。

Edge Function 的服务端 secrets：

```bash
supabase secrets set DEEPSEEK_API_KEY=YOUR_SECRET
supabase secrets set DEEPSEEK_MODEL=deepseek-flash
```

## Supabase 创建与配置

1. 创建 Supabase 项目，在 Authentication 中启用 Email provider。
2. 在 SQL Editor 运行 [初始 migration](./supabase/migrations/202609220001_initial_schema.sql)，或使用 Supabase CLI：

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

3. Migration 会创建：
   - `profiles`
   - `products`
   - `product_images`
   - `favorites`
   - `trade_requests`
   - `conversations`
   - `messages`
4. Migration 同时创建公开读取、所有者写入的 `product-images` bucket，单文件限制 5 MB，只允许 JPG/PNG/WebP。
5. Migration 把 `messages` 加入 `supabase_realtime` publication。
6. 注册两个测试账号，以买家/卖家身份分别测试权限与交易状态。
7. 可选：注册至少一个账号后运行 [seed.sql](./supabase/seed.sql)。图片应通过应用上传，以保持 Storage 所有权路径正确。

### RLS 与数据库状态流

- 公开用户只读在售/预订商品；卖家可读写自己的其他状态商品。
- 收藏只属于当前用户，并由唯一约束防止重复。
- 交易请求只对买卖双方可见；前端不能直接更新状态。
- `transition_trade_request` RPC 锁定交易记录、验证操作者与合法转换，并原子更新商品状态。
- 会话按商品/买家/卖家唯一；`get_or_create_conversation` RPC 防止重复会话。
- 消息只允许参与者读取/发送；客户端只获准更新 `read_at`。
- Storage 写入路径必须是 `用户 UUID/商品 UUID/文件名`，删除仅限所有者。

## AI provider 与 fallback

前端只调用 `supabase/functions/ai-assistant`，秘密 Key 仅存在于 Edge Function。部署：

```bash
supabase functions deploy ai-assistant
```

自动填写会先把浏览器中的商品图压缩到适合视觉识别的大小，再由 Edge Function 发送给 DeepSeek Responses API 的 `deepseek-flash` 视觉模型。模型提取主要商品、可见文字、颜色与外观状态，并以 JSON Schema 返回可编辑草稿。图片不会写入前端环境变量，DeepSeek Key 只保存在 Supabase secrets。

若函数、模型或 Key 不可用，页面自动使用独立规则解析器：

- 智能检索：价格上下限/区间、常见分类、商品关键词、常见成色。
- 自动填写：从原始文字提取名称、分类、售价、成色、描述和地点；缺失字段明确标记。

详细提示词、JSON Schema 和事实边界见 [docs/prompt-library.md](./docs/prompt-library.md)。

## 质量检查

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## 连接与登录排障

- 首页商品与登录同时失败时，先确认浏览器能访问 `VITE_SUPABASE_URL` 对应的 `*.supabase.co` 域名。
- 使用 TUN、代理或 fake-IP DNS 时，需要确保 `supabase.com` 与 `*.supabase.co` 被正确转发；TLS 握手失败不是邮箱或密码错误。
- 登录成功但个人资料无法读取时，确认远端已经应用全部 migration；最新修复 migration 会补建历史账号缺失的 `profiles`。
- 本地临时查看 UI 可清空两项 Supabase 环境变量进入演示模式，但不要把演示数据当成真实数据。

## 部署

### Vercel

1. 将仓库推送到 Git 托管平台并导入 Vercel。
2. Build command 使用 `npm run build`，Output directory 使用 `dist`。
3. 添加 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`。
4. `vercel.json` 已包含 SPA 回退规则。
5. 在 Supabase Authentication → URL Configuration 添加生产域名与回调域名。

### Netlify

Build command 使用 `npm run build`，Publish directory 使用 `dist`；`public/_redirects` 已提供 SPA 回退。

## 当前明确不支持

- 在线付款、物流、学校认证、校园邮箱限制或统一身份认证
- 用户评分/信用系统、复杂管理员后台
- AI 商品推荐与个性化推荐
- 聊天图片、语音、视频或文件
- AI 只生成待确认草稿，不替用户验证商品真伪、内部功能或执行发布

## 安全提示

面交请选择公共地点，当面核对物品状态。不要在聊天中发送支付密码、验证码或其他敏感信息。
