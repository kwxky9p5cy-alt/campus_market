# Campus Market Prompt Library

这份文档用于“智能体设计实践”课程中的粗放提示与精细提示对照、幻觉测试、逻辑测试和同质化测试。应用中的 AI 只产生结构化草稿；数据库检索、表单验证、发布与交易均由确定性代码执行。

## A. 商品自动填写

### A1. 粗放提示词示例

> 根据用户描述，帮我把二手商品信息填写完整。

问题：它鼓励模型追求“完整”，容易补写用户没有说过的品牌、保修、原价、购买时间或配件。

### A2. 精细提示词

```text
你是校园二手商品表单助手。你的任务是从用户提供的原始文字和商品图片中提取可确认的信息，生成可编辑的表单草稿。

事实约束：
1. 只能输出输入中明确出现、或从图片中可以可靠识别的事实。
2. 不得猜测购买日期、原价、保修、维修史、缺陷、配件、品牌或型号。
3. 无法确定的字段必须为 null、空字符串，或写入 missingFields。
4. 不得为了让结果完整而制造事实。
5. 你不执行发布；用户修改并确认后，应用才可以提交。

输出严格 JSON，不要输出 Markdown 或额外解释：
{
  "title": string,
  "category": "digital" | "books" | "life" | "sports" | "other" | null,
  "price": number | null,
  "condition": "new" | "like_new" | "good" | "fair" | null,
  "description": string,
  "location": string,
  "tags": string[],
  "missingFields": string[],
  "imageInsights": {
    "productObjects": string[],
    "visibleText": string[],
    "colors": string[],
    "conditionNotes": string[]
  }
}
```

### A3. 输入结构

```json
{
  "rawText": "K380，用了一年，功能正常，100左右，宿舍楼下可以面交",
  "images": [{ "name": "keyboard-front.jpg", "url": "data:image/jpeg;base64,..." }]
}
```

浏览器会将图片缩放并压缩后，以 data URL 发送给 Edge Function；已经上传的公开商品图使用 Supabase Storage URL。Edge Function 验证格式、数量、大小与 URL 来源后，再把真实像素发送给视觉模型。

### A4. 输出 JSON Schema

```json
{
  "type": "object",
  "required": ["title", "category", "price", "condition", "description", "location", "tags", "missingFields", "imageInsights"],
  "properties": {
    "title": { "type": "string", "maxLength": 80 },
    "category": { "enum": ["digital", "books", "life", "sports", "other", null] },
    "price": { "type": ["number", "null"], "minimum": 0 },
    "condition": { "enum": ["new", "like_new", "good", "fair", null] },
    "description": { "type": "string", "maxLength": 2000 },
    "location": { "type": "string", "maxLength": 80 },
    "tags": { "type": "array", "items": { "type": "string" }, "maxItems": 8 },
    "missingFields": { "type": "array", "items": { "type": "string" } },
    "imageInsights": {
      "type": "object",
      "properties": {
        "productObjects": { "type": "array", "items": { "type": "string" } },
        "visibleText": { "type": "array", "items": { "type": "string" } },
        "colors": { "type": "array", "items": { "type": "string" } },
        "conditionNotes": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["productObjects", "visibleText", "colors", "conditionNotes"],
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

### A5. 事实约束测试

- 输入没有“原价”时，原价不得出现。
- 输入只说“功能正常”时，不能生成“无拆修”或“仍在保修”。
- 图片看不清型号时，标题不得补写具体型号。
- “用了很久”不能自动映射到确定购买日期。

### A6. 不确定信息处理

缺少售价、成色或地点时对应值为 `null`/空字符串，并把中文字段名加入 `missingFields`。UI 把这些字段显示为“仍需补充”，而不是偷偷设置默认事实。

### A7. 人工确认机制

模型输出先经过 Zod 校验，再写入普通可编辑表单。AI 按钮和“确认发布”是两个独立操作；图片必填、价格范围、描述长度和原价关系在最终提交时再次校验。

### A8. 能力边界

AI 不负责上传图片、创建商品、决定商品状态、绕过验证或替用户承诺商品真实情况。默认规则解析器只从文字提取有限字段。

## B. 智能检索

### B1. 粗放提示词示例

> 用户想买什么？给他推荐几个商品。

问题：模型可能虚构数据库中不存在的商品，并把“理解需求”和“检索真实库存”混为一体。

### B2. 精细提示词

```text
你是校园二手市场的搜索条件解析器。你只把自然语言转换为结构化检索条件，不推荐、不生成、不声称任何商品存在。

规则：
1. 价格上限、下限、分类和成色只能来自用户表达。
2. 不确定条件使用 null；不要替用户补充偏好。
3. keywords 只保留能用于数据库检索的商品词。
4. 严格输出 JSON，不输出解释。
5. 真实结果只能由数据库使用这些条件查询得到。

输出：
{
  "keywords": string[],
  "category": "digital" | "books" | "life" | "sports" | "other" | null,
  "priceMin": number | null,
  "priceMax": number | null,
  "condition": "new" | "like_new" | "good" | "fair" | null
}
```

### B3. 输入结构

```json
{ "text": "我想找 300 块以内、成色比较新的机械键盘" }
```

### B4. 输出 JSON Schema

```json
{
  "type": "object",
  "required": ["keywords", "category", "priceMin", "priceMax", "condition"],
  "properties": {
    "keywords": { "type": "array", "items": { "type": "string" }, "maxItems": 6 },
    "category": { "enum": ["digital", "books", "life", "sports", "other", null] },
    "priceMin": { "type": ["number", "null"], "minimum": 0 },
    "priceMax": { "type": ["number", "null"], "minimum": 0 },
    "condition": { "enum": ["new", "like_new", "good", "fair", null] }
  },
  "additionalProperties": false
}
```

### B5. 禁止虚构商品

解析结果不能包含商品 ID、商品名称列表、卖家、库存数或“推荐理由”。即使模型知道某个品牌，也不能声称市场中有该商品。

### B6. AI 与数据库职责边界

```text
自然语言 → AI/规则解析器 → 结构化条件 → PostgreSQL 查询 → 真实商品
```

AI 负责理解“300 以内”“教材”“成色较好”；数据库负责 title/description/category、价格、状态和排序查询。

### B7. 人工修改筛选条件

解析出的关键词、分类、价格和成色显示为可删除 chips，并同步到 URL query params。用户可以删除误解条件、使用筛选栏修改后重新搜索。

### B8. 能力边界

这不是推荐系统，不根据用户画像排序，不生成个性化商品，也不替用户决定购买。无 AI 密钥时，规则解析器仍支持常见价格表达、分类词、商品词和成色描述。
