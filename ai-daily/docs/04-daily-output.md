# 日报输出与 HTML

## Output Contract

输出文件：

- Markdown 格式：`ai-daily-<主题>-YYYY-MM-DD.md`
- （写入位置）默认写入 `ai-daily/runs/<runId>/` 目录，其中 `runId` 默认形如 `daily-<topic>-YYYY-MM-DD-HHMMSS`
- **语音稿**（可选）：`*-blog-voice.md`（结构必须兼容 `scripts/voice_to_audio.ts`）
- **录音**（可选）：与语音稿同主文件名、扩展名为 `.mp3`（由 `scripts/voice_to_audio.ts` 生成）
- **结构化中间层（强制）**：`runs/<runId>/news.json`（由 Agent 生成，供脚本做确定性校验与转换）
- 位置：当前执行目录（或用户指定目录）

输出结构（必须包含）：

1. `# 信息源日报 - YYYY-MM-DD`
2. `## 今日重点`
3. `## 今日资讯`：每条新闻**独占一行**，格式为 `序号.【分类】新闻描述 [原文](URL)`（见下方模板）
4. `## 今日总结`
5. `## 未来展望`

口径降级规则（强制）：

- `今日重点` 不得包含任何“待核实”条目（包含“证据不足/来源不足/原文链接未解析”等）。
- 若某条只达到“待核实”，允许进入 `今日资讯`，但必须在该条摘要末尾或描述前缀显式标注 `待核实：xxx`，并降低该条在排序池中的权重（避免与高置信确定结论混排）。

链接要求：

- **主链接必须是原文 URL**（见 [05-links-and-aggregation.md](05-links-and-aggregation.md)）；禁止把聚合页/列表页当作唯一外链
- 仅在确实无法解析原文时，才可使用聚合页 URL，并在该行摘要末尾用括号注明「原文链接未解析」

## Daily Report Template

每条资讯 **必须单行**，格式为：`序号.【分类】新闻描述 [原文](URL)`。描述与链接之间空一格；`URL` 须为**原文链接**。

```markdown
# 信息源日报 - YYYY-MM-DD

## 今日重点
- 覆盖来源：A / B / C
- 主题聚焦：<主题>
- 条目总数：<N>

## 今日资讯
1. 【<分类>】<摘要（1-2句）> [原文](https://原文站点/文章路径)
2. 【<分类>】<摘要（1-2句）> [原文](https://原文站点/文章路径)
3. 【<分类>】<摘要（1-2句）> [原文](https://原文站点/文章路径)

<!-- 条数按实际上限继续编号，始终保持一行一条 -->

## 今日总结
- <3-5 条总结>

## 未来展望
- <值得持续跟踪的方向>
```

## Quick Start Prompt

```text
使用 ai-daily 技能生成今天的中文日报。
主题：AI Agent
时间范围：最近 24 小时
来源：种子来源（用于起步）：Readhub daily, Readhub AI, GitHub Trending, Juya RSS, AI Hub Today；若成稿时来源多样性底线不达标（独立来源数 < 4 或任一来源占比 > 40%），自动启动 Discovery 扩源，增加至少 2 个新站点/源并完成 recipe 保存与小样本验证。
条数上限：100
输出：自动写入 `ai-daily-<主题>-YYYY-MM-DD.md`（默认不生成 `.html`；如需 HTML 需自行恢复脚本）
```

## HTML 导出（默认不可用）

可使用 `scripts/render_report_html.ts` 导出 HTML（视频链路本身不依赖 HTML）。

视频链路（Remotion）不依赖 HTML：若你只生成视频，请忽略本节；若你需要 HTML，可由你在本地恢复脚本后再按原命令使用。

## Agent JSON Contract（用于脚本）

`news.json` 由 Agent 产出，脚本只验证并转换，不做语义推断。

```json
{
  "date": "2026-03-30",
  "title": "AI 日报",
  "subtitle": "聚焦AI领域最新动态",
  "news": [
    {
      "idx": 1,
      "category": "模型进展",
      "summary": "新闻摘要",
      "url": "https://example.com/news-1"
    }
  ]
}
```

字段规则：
- `date`：`YYYY-MM-DD`
- `news[].idx`：正整数，建议从 1 递增，需与音频 `news-N.mp3` 对齐
- `news[].category/summary/url`：必填
- `news[].title/source/publishTime`：可选

对应脚本命令：

```bash
bun scripts/build_remotion_daily_props.ts \
  --news-json ai-daily/runs/<runId>/news.json \
  --audio-dir ai-daily/runs/<runId>/audio \
  --out-json ai-daily/runs/<runId>/daily.json
```
