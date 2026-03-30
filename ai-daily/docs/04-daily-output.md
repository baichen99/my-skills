# 日报输出与 HTML

## Output Contract

输出文件：

- Markdown 格式：`info-source-daily-YYYY-MM-DD.md`
- HTML 格式：`info-source-daily-YYYY-MM-DD.html`（自动生成，同名文件）
- **语音稿**（可选）：`info-source-voice-YYYY-MM-DD.md` 或 `ai-daily-voice-<主题>-YYYY-MM-DD.md`
- **录音**（可选）：与语音稿同主文件名、扩展名为 `.mp3`（由 `scripts/voice_to_audio.py` 生成）
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
使用 info-source-daily 技能生成今天的中文日报。
主题：AI Agent
时间范围：最近 24 小时
来源：种子来源（用于起步）：Readhub daily, Readhub AI, GitHub Trending, Juya RSS, AI Hub Today；若成稿时来源多样性底线不达标（独立来源数 < 4 或任一来源占比 > 40%），自动启动 Discovery 扩源，增加至少 2 个新站点/源并完成 recipe 保存与小样本验证。
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
