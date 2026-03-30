# 总览与触发

## 目标

从多个信息源抓取内容，合并去重后生成中文日报，输出为带日期的 Markdown 文件；可选生成语音稿与 MP3。

核心目标：

- 覆盖多个来源（RSS + 网站）
- 给出结构化摘要（分类、要点、原文链接）
- 产出可直接分享/归档的日报文件

## 默认来源（可扩展）

- Readhub 每日早报：`https://readhub.cn/daily`
- Readhub AI 新闻：`https://readhub.cn/news/ai`
- GitHub Trending：`https://github.com/trending`
- Juya AI Daily RSS：`https://imjuya.github.io/juya-ai-daily/rss.xml`
- AI Hub Today：`https://ai.hubtoday.app/blog/index.xml`

## 核心原则

1. **Agent Browser 优先**：默认先使用 Playwright 抓取，保证页面渲染一致性与稳定性。
2. **统一使用 Agent Browser**：所有类型源（HTML/RSS/API/静态页）全部使用 Agent Browser 处理，不使用 WebFetch。
3. **链接必须指向原文**：日报里每条新闻的主链接必须是**外站原文/一手来源 URL**，禁止用聚合列表页、频道页或聚合站站内详情页充当「原文链接」（避免把流量导向聚合方）。
4. **先可用再完美**：先产出当天日报，再迭代 recipe 和排序策略。
5. **Discovery 大胆、交付严谨**：新站点探索时主动用搜索、内部检索与多路径试探；recipe 仍必须保存并验证。

## When to Use

- 需要把多个来源汇总成「今天看什么」的日报
- 需要 AI 进行去重、分类、摘要、排序
- 需要固定格式输出并每天落盘存档

## Required Inputs

- 时间范围（默认最近 24h）
- 来源范围（默认全部来源，可增减）
- 每日条数上限（默认 10-15 条）

## Quality Bar

- 摘要应「信息增量明确」，避免改写标题
- 分类标签要稳定，避免同义词碎片化
- Top 条目应覆盖不同来源，避免单一来源垄断
- 保留失败来源记录，避免「静默缺失」
- **「今日」须名副其实**：每条收录应对齐约定时间窗口内的**原文发布日期**；列表/热门排序不能代替日期核验（见 [08-timeliness-and-filters.md](08-timeliness-and-filters.md)）
