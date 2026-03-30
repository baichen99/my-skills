# 抓取、Recipe 与稳定性

> 说明：本节描述的是「你在实际抓取执行器/Agent 中应遵循的策略与容错原则」（如重试、健康检查、自修复、recipe 自动更新等）。  
> `ai-daily/` 目录内当前主要提供 `site-recipes/*.yaml` 管理与口播/合成脚本；因此若你的抓取执行器在其他位置已实现这些逻辑，请以实现为准；若暂未实现，请把本节当作“目标行为/检查清单”而非保证已具备。

## Site Recipe (YAML)

Site Recipe 用于描述「如何访问和提取一个站点」。

存放位置：`site-recipes/{site-id}.yaml`

最小字段建议：

- `id`, `name`
- `access.url`, `access.needsBrowser`, `access.waitFor`
- `extraction.listSelector`, `extraction.fields`
- `pagination`（可选）

字段命名建议：

- 必选：`title`, `url`（列表项或条目入口链接）
- **推荐**：`sourceUrl`（或 `originalUrl`）— **指向外站原文**的 URL；首轮能抽到则填；**抽不到很正常**，交给「补链与校验阶段」处理，不要为凑字段造假链接
- 推荐：`description`, `publishedAt`, `author`, `source`

## Discovery Mode

**【强制要求】首次访问任何新站点时必须执行 Discovery 并落盘 recipe，不得跳过**；但**探索过程本身要大胆**，不要「只开一眼首页就定稿」。

### 探索要大胆（推荐主动用工具）

在写出 YAML 之前，鼓励**并行、多路径**摸清站点形态，再收敛到选择器：

- **站内/站外检索**：用 **Web 搜索**、站点自带搜索框（浏览器里实际搜）、相关文档/博客，确认列表页、RSS、移动端页、API 文档等**哪条路径最稳**；若首页是运营位而非资讯流，主动换 URL（如 `/news`、`/feed`、`/blog`）。
- **内部能力**：用 **代码库/仓库内搜索**（`site-recipes`、同类站点 recipe、历史日报）找**可类比**的字段名与选择器模式；用 **语义搜索** 查「本站是否曾有人写过 recipe」类线索。
- **页面结构**：不只等一个 `waitFor`，可尝试滚动、切换 Tab、展开「更多」、看列表第二页，确认**列表容器是否稳定**、分页是否必须。
- **字段尽量多探**：除 `title`/`url` 外，优先试抽 `publishedAt`、`sourceUrl`（见「原文链接」相关文档），避免后续补链成本过高。
- **失败也值钱**：若某路径反爬或结构怪异，在 recipe 或备注里写一句**尝试过什么、为何放弃**，便于下次迭代。

**收口不变**：无论探索多发散，最终仍须**生成并保存** `site-recipes/{site-id}.yaml`，并做小样本验证——探索可以大胆，**交付不能省略**。

### Discovery 流程（建议顺序）

1. **背景与路径**：结合搜索与内部检索，确认目标 URL 是否为最佳入口；必要时列出 2～3 个候选页并快速对比。
2. **打开目标页**（Agent Browser）：等待关键节点，必要时滚动/交互。
3. **识别列表容器与字段选择器**（可对比本站其它栏目或同类站点 recipe）。
4. **生成并保存** recipe 到 `site-recipes/{site-id}.yaml`。
5. **立即做小样本验证**（至少 3 条），含日期/链接字段抽查。
6. 验证通过后，该站点后续访问**以已保存 recipe 为准**。

> 重要提示：只要不在现有 `site-recipes` 中的站点，都视为新站点，必须执行 Discovery 并**保存** recipe；**禁止**只做临时抓取、不保存、不验证。

## Fetch Rules

- 默认优先使用 Agent Browser，即使是可静态抓取页面也可先走浏览器路径
- `needsBrowser: true` 时，禁止退化为普通 HTTP 抓取
- 仅当来源为稳定 RSS/静态页且已验证结构稳定时，才允许使用 WebFetch
- 抓取失败要返回明确错误类型：超时/选择器失效/反爬/权限
- 有分页时限制最大页数，避免超时（建议 `maxPages <= 5`）
- 对相对链接做绝对化处理

## Stability Enhancement

### Retry Mechanism

- 抓取失败自动重试：默认 3 次重试，指数退避（1s → 3s → 5s）
- 重试触发条件：网络超时、5xx 错误、临时反爬拦截
- 重试跳过条件：4xx 错误（权限不足/页面不存在）、内容解析失败（非临时问题）
- 每个来源独立计数重试次数，不影响其他来源

### Failure Degradation

- 单来源失败不影响整体流程，标记失败后继续处理其他来源
- 所有场景优先使用 Agent Browser，失败后使用 Agent Browser 重试，不降级到 WebFetch
- 针对 RSS/XML/API 等非 HTML 内容，使用 Agent Browser 直接获取原始响应内容解析
- 内容解析失败时，自动尝试备用选择器（在 recipe 中配置 `fallbackSelectors`）
- 反爬拦截时，自动尝试模拟人工操作：滚动页面、等待、点击验证按钮等

### Timeout Management

- 全局超时：单来源抓取总超时不超过 30s
- 阶段超时：页面加载 15s，内容提取 10s，网络请求 10s
- 超时后自动终止当前来源抓取，记录失败原因
- 允许用户自定义超时参数：`--timeout 60` 全局调整

### Health Check

- 每次执行前自动检查所有配置来源的可用性
- 对连续 3 次失败的来源，自动标记为「不健康」并跳过下次执行
- 不健康来源每周自动重试一次，恢复后自动重新启用
- 输出健康报告：列出健康/不健康来源及失败率

## Flexible Fetch Strategy

### Adaptive Fetch Mode

- 统一使用 Agent Browser 处理所有类型的源：HTML 页面、RSS/XML/JSON Feed、API 接口等
- 自动识别响应内容类型，动态调整解析策略
- 支持混合模式：同一站点不同页面使用适配的内容解析逻辑
- 可配置抓取行为：允许用户自定义页面加载等待条件、前置操作等

### Enhanced Site Recipe

- 新增 `fallbackSelectors` 字段：支持多套选择器，主选择器失败时自动尝试备用
- 新增 `customHeaders` 字段：支持自定义请求头，应对反爬机制
- 新增 `rateLimit` 字段：支持请求速率限制，避免触发反爬
- 新增 `preActions` 字段：支持抓取前执行自定义动作（点击、滚动、填写表单等）

### Multi-format Source Support

- 原生支持 RSS/Atom/JSON Feed 格式，无需额外配置
- 支持 API 接口抓取：自动处理 JSON 响应格式
- 支持分页抓取：自动识别和遍历分页链接
- 支持增量更新：仅抓取上次执行后新增的内容

## Self-Repair Capability

### Automatic Error Diagnosis

- 抓取失败时自动诊断问题类型：网络问题/反爬/页面结构变化/权限问题
- 针对不同问题类型给出修复建议，自动尝试可执行的修复方案
- 记录失败场景和解决方案，持续学习优化修复策略

### Recipe Auto-Update

- 页面结构变化导致解析失败时，自动触发 Discovery 模式重新生成 recipe
- 新旧 recipe 对比验证，确认有效后自动更新保存
- 保留历史版本，更新失败自动回滚到上一有效版本

### Fallback Ecosystem

- 内置常见站点的备用抓取方案，主方案失效时自动启用
- 支持社区贡献的 recipe 库，自动同步更新最新可用 recipe
- 无法自动修复时，生成详细的问题报告，方便人工介入处理
