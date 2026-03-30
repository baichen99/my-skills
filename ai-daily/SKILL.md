---
name: ai-daily
description: Use when producing a daily brief by aggregating multiple regularly-updated sources (RSS, news sites, trending pages), then deduplicating, summarizing, and writing a dated Markdown report file; filter by publication date for "today"; optionally a voice script then MP3 in that order via Volcengine TTS.
---

# AI Daily

技能说明已**按环节拆成多篇 Markdown**，执行时按需打开对应文件（路径均相对于 **`ai-daily/`** 目录）。

| 环节 | 文档 |
|------|------|
| 总览、触发条件、质量要求 | [docs/01-overview.md](docs/01-overview.md) |
| 流水线（准备→产出） | [docs/02-workflow.md](docs/02-workflow.md) |
| Recipe、Discovery、抓取与稳定性 | [docs/03-fetch-and-recipes.md](docs/03-fetch-and-recipes.md) |
| 日报结构、模板、HTML 导出 | [docs/04-daily-output.md](docs/04-daily-output.md) |
| 原文链接与聚合页 | [docs/05-links-and-aggregation.md](docs/05-links-and-aggregation.md) |
| **语音：先文字稿，再录音** | [docs/06-voice-and-audio.md](docs/06-voice-and-audio.md)（口播稿：技能内大模型生成；可用 `scripts/daily_to_blog_voice.py` 兜底对照） |
| 常见错误与备注 | [docs/07-pitfalls.md](docs/07-pitfalls.md) |
| **「今日」时效与过滤** | [docs/08-timeliness-and-filters.md](docs/08-timeliness-and-filters.md) |

仓库内脚本与目录说明见 [README.md](README.md)。

**新站点 Discovery**：探索阶段宜**大胆**——善用 Web/站内搜索、仓库内检索与类比已有 `site-recipes`；多 URL、多交互试探后再收敛选择器；**仍须**保存 YAML 并验证（见 [docs/03-fetch-and-recipes.md](docs/03-fetch-and-recipes.md)「Discovery Mode」）。

## 产出阶段速记（必须）

### 日报与 HTML

1. 定稿日报：`ai-daily-<主题>-YYYY-MM-DD.md`（收录前须按 [08-timeliness-and-filters.md](docs/08-timeliness-and-filters.md) 过滤**原文发布日期**在窗口内，避免旧闻混入「今日」）。
2. `scripts/render_report_html.py` → 同名 `.html`。

### 口播：先文字稿，再录音（禁止颠倒）

1. **第一步（推荐）**：由技能内大模型直接读取定稿日报，生成**口播文字稿**（仅生成 `.md`，不生成音频）：

   ```bash
   # 生成目标：`*-blog-voice.md`（结构必须兼容 voice_to_audio.py）
   # 由 Agent 内部模型输出并落盘；本地不需要额外调用 LLM API。
   ```

   得到 `*-blog-voice.md` 后，**审阅、必要时手工编辑**；确保正文已用 `## 正文` + `### 第 N 条` 分条。

   （可选 fallback：如果你仍想用固定规则编译口播，可用下面脚本补一版或做对照）

   ```bash
   python scripts/daily_to_blog_voice.py <日报.md>
   ```

2. **第二步**：文字稿确认后，再生成 **MP3**（TTS 编译）：

   ```bash
   python scripts/export_voice_mp3.py <*-blog-voice.md>
   ```

   （需本机已配置火山 TTS 凭证。）

`daily_to_blog_voice.py --audio` 可一步生成 MP3，仅作便捷；**默认流程**仍应先完成第 3 步再执行第 4 步。
