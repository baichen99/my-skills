---
name: ai-daily
description: Use when producing a daily brief by aggregating multiple regularly-updated sources (RSS, news sites, trending pages), then deduplicating, summarizing, and writing a dated Markdown report file.
---

# AI Daily

## Overview

从多个信息源抓取内容，合并去重后生成中文日报，输出为带日期的 Markdown 文件。

核心目标：
- 覆盖多个来源（RSS + 网站）
- 给出结构化摘要（分类、要点、原文链接）
- 产出可直接分享/归档的日报文件

默认来源（可扩展）：
- Readhub 每日早报：`https://readhub.cn/daily`
- Readhub AI 新闻：`https://readhub.cn/news/ai`
- GitHub Trending：`https://github.com/trending`
- Juya AI Daily RSS：`https://imjuya.github.io/juya-ai-daily/rss.xml`
- AI Hub Today：`https://ai.hubtoday.app/blog/index.xml`

核心原则：
1. **Agent Browser 优先**：默认先使用 Playwright 抓取，保证页面渲染一致性与稳定性。
2. **统一使用 Agent Browser**：所有类型源（HTML/RSS/API/静态页）全部使用 Agent Browser 处理，不使用 WebFetch。
3. **链接必须可追溯**：日报中应尽量给原始文章来源链接，不只给聚合页链接。
4. **先可用再完美**：先产出当天日报，再迭代 recipe 和排序策略。

## When to Use

- 需要把多个来源汇总成“今天看什么”的日报
- 需要 AI 进行去重、分类、摘要、排序
- 需要固定格式输出并每天落盘存档

## Required Inputs

- 时间范围（默认最近 24h）
- 来源范围（默认全部来源，可增减）
- 每日条数上限（默认 10-15 条）

## Output Contract

输出文件：
- Markdown 格式：`info-source-daily-YYYY-MM-DD.md`
- HTML 格式：`info-source-daily-YYYY-MM-DD.html`（自动生成，同名文件）
- 位置：当前执行目录（或用户指定目录）

输出结构（必须包含）：
1. `# 信息源日报 - YYYY-MM-DD`
2. `## 今日重点`
3. 编号新闻列表（每条含：分类、摘要、原文链接、来源）
4. `## 今日总结`
5. `## 未来展望`

链接要求：
- 优先写原始文章来源 URL
- 若暂时只能拿到聚合页，需在条目中标注“来源为聚合页”

## Workflow

1. **准备阶段**
   - 确认主题、时间范围、条数上限
   - 检查来源可访问性（快速探测）
2. **抓取阶段**
   - 默认使用 Agent Browser 抓取所有来源
   - 仅对明确静态/RSS 来源使用 WebFetch（可选优化）
   - 新站点先 Discovery，再写 recipe
3. **清洗阶段**
   - URL 归一化（去追踪参数）
   - 去重（同 URL 或高度相似标题）
   - 过滤低价值项（广告、活动页、无正文）
4. **分析阶段**
   - 按主题分类
   - 生成中文摘要（1-2 句）
   - 评估优先级并排序
5. **产出阶段**
   - 按模板生成 Markdown
   - 保存到 `ai-daily-[subject]-YYYY-MM-DD.md`
   - 自动调用 `scripts/render_report_html.py` 生成同名 HTML 文件
   - 给出“抓取失败清单 + 原因”

## Site Recipe (YAML)

Site Recipe 用于描述“如何访问和提取一个站点”。

存放位置：`site-recipes/{site-id}.yaml`

最小字段建议：
- `id`, `name`
- `access.url`, `access.needsBrowser`, `access.waitFor`
- `extraction.listSelector`, `extraction.fields`
- `pagination`（可选）

字段命名建议：
- 必选：`title`, `url`
- 推荐：`description`, `publishedAt`, `author`, `source`

## Discovery Mode

**【强制要求】首次访问任何新站点时必须执行，不得跳过**：
1. 打开目标 URL
2. 等待关键节点出现
3. 识别列表容器与字段选择器
4. 生成并保存 recipe 到 `site-recipes/{site-id}.yaml`
5. 立即做一次小样本验证（至少 3 条）
6. 验证成功后该站点后续访问直接使用已保存的recipe

> 重要提示：只要是不在现有site-recipes目录中的站点，都视为新站点，必须执行Discovery流程生成recipe文件，不得临时抓取不保存。

## Fetch Rules

- 默认优先使用 Agent Browser，即使是可静态抓取页面也可先走浏览器路径
- `needsBrowser: true` 时，禁止退化为普通 HTTP 抓取
- 仅当来源为稳定 RSS/静态页且已验证结构稳定时，才允许使用 WebFetch
- 抓取失败要返回明确错误类型：超时/选择器失效/反爬/权限
- 有分页时限制最大页数，避免超时（建议 `maxPages <= 5`）
- 对相对链接做绝对化处理

## Stability Enhancement

### Retry Mechanism
- 抓取失败自动重试：默认3次重试，指数退避（1s → 3s → 5s）
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
- 对连续3次失败的来源，自动标记为"不健康"并跳过下次执行
- 不健康来源每周自动重试一次，恢复后自动重新启用
- 输出健康报告：列出健康/不健康来源及失败率

## Flexible Fetch Strategy

### Adaptive Fetch Mode
- 统一使用 Agent Browser 处理所有类型的源：HTML页面、RSS/XML/JSON Feed、API接口等
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
- 页面结构变化导致解析失败时，自动触发Discovery模式重新生成recipe
- 新旧recipe对比验证，确认有效后自动更新保存
- 保留历史版本，更新失败自动回滚到上一有效版本

### Fallback Ecosystem
- 内置常见站点的备用抓取方案，主方案失效时自动启用
- 支持社区贡献的recipe库，自动同步更新最新可用recipe
- 无法自动修复时，生成详细的问题报告，方便人工介入处理

## Quality Bar

- 摘要应“信息增量明确”，避免改写标题
- 分类标签要稳定，避免同义词碎片化
- Top 条目应覆盖不同来源，避免单一来源垄断
- 保留失败来源记录，避免“静默缺失”

## Daily Report Template

```markdown
# 信息源日报 - YYYY-MM-DD

## 今日重点
- 覆盖来源：A / B / C
- 主题聚焦：<主题>
- 条目总数：<N>

## 今日资讯
1. 【<分类>】<摘要（1-2句）>
   - 原文：<URL>
   - 来源：<站点名>

2. 【<分类>】<摘要（1-2句）>
   - 原文：<URL>
   - 来源：<站点名>

<!-- ... -->

## 今日总结
- <3-5 条总结>

## 未来展望
- <值得持续跟踪的方向>
```

## Quick Start Prompt

```text
使用 info-source-daily 技能生成今天的中文日报。
主题：AI Agent
时间范围：最近 24 小时
来源：Readhub daily, Readhub AI, GitHub Trending, Juya RSS, AI Hub Today
条数上限：12
输出：自动写入 info-source-daily-YYYY-MM-DD.md 和同名 .html 文件
```

## HTML 导出（最小依赖）

提供零第三方依赖脚本：`scripts/render_report_html.py`

```bash
python scripts/render_report_html.py info-source-daily-YYYY-MM-DD.md
```

可指定输出文件：

```bash
python scripts/render_report_html.py info-source-daily-YYYY-MM-DD.md -o daily.html
```

说明：

- 仅依赖 Python 标准库（`argparse`/`re`/`html` 等）
- 支持常用 Markdown 元素：`#`/`##`/`###`、有序/无序列表、行内代码、链接
- 输出为单文件 HTML（内置 CSS），无外部资源依赖

## Common Mistakes

- 只给聚合页链接，未追溯原文链接
- 页面是动态渲染却仍使用静态抓取
- 未按默认策略优先使用 Agent Browser
- 去重仅按标题，导致同一事件重复收录
- 【严重错误】访问新站点未执行Discovery模式、未生成/保存对应的site recipe文件
- 没有输出失败来源，造成“看起来都成功了”的错觉

## Notes

- Recipe 可自动生成，也可人工维护
- 若源站存在登录/验证码，需明确标注“需要人工介入”
- 建议每周抽样校验一次 recipe，防止站点结构变更导致静默失效
