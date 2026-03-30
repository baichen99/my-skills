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
| **语音：先文字稿，再录音** | [docs/06-voice-and-audio.md](docs/06-voice-and-audio.md)（口播稿：技能内大模型生成；如需录音仅保留 `scripts/voice_to_audio.py`） |
| 常见错误与备注 | [docs/07-pitfalls.md](docs/07-pitfalls.md) |
| **「今日」时效与过滤** | [docs/08-timeliness-and-filters.md](docs/08-timeliness-and-filters.md) |

仓库内脚本与目录说明见 [README.md](README.md)。

**新站点 Discovery**：探索阶段宜**大胆**——善用 Web/站内搜索、仓库内检索与类比已有 `site-recipes`；多 URL、多交互试探后再收敛选择器；**仍须**保存 YAML 并验证（见 [docs/03-fetch-and-recipes.md](docs/03-fetch-and-recipes.md)「Discovery Mode」）。

## 产出阶段速记（必须）
### 执行约束：强制从抓取开始（禁止复用）
每次收到任务时，都必须按工作流从“获取数据→生成日报→口播稿→合成音频→生成视频”重新跑一遍，不得复用任何先前已经产出的同日期中间文件/结果。

抓取阶段要求：禁止用任何“抓取并直接生成视频”的全流程脚本（例如 `scripts/run_ai_daily_to_video.py`）；抓取与补链由 Agent Browser 交互完成，产物只落在 `runs/<runId>/` 记录目录中。

为避免“复用旧结果导致未更新”的情况，执行前应至少满足以下任一策略（两者可叠加）：
- 若存在目标 `runs/<runId>/` 记录目录，则先删除或强制覆盖后再生成。
- 渲染视频前，必须保证 `ai-daily/runs/<runId>/daily.json` 是本次运行生成的“新数据文件”，且其 `news.audio/backgroundAudio/endingAudio` 字段指向本次运行生成并可被 Remotion 访问的音频资源（本方案使用 base64 data URI，降低访问路径依赖）。

### 日报与 HTML

1. 定稿日报：`ai-daily/runs/<runId>/ai-daily-<主题>-YYYY-MM-DD.md`（其中 `runId` 默认形如 `daily-<topic>-YYYY-MM-DD-HHMMSS`；收录前须按 [08-timeliness-and-filters.md](docs/08-timeliness-and-filters.md) 过滤**原文发布日期**在窗口内，避免旧闻混入「今日」）。
2. HTML 导出脚本 `scripts/render_report_html.py` 已删除：默认不生成 `.html`（视频链路不依赖 HTML）。

### 口播：先文字稿，再录音（禁止颠倒）

1. **第一步（推荐）**：由技能内大模型直接读取定稿日报，生成**口播文字稿**（仅生成 `.md`，不生成音频）：

   ```bash
   # 生成目标：`*-blog-voice.md`（结构必须兼容 voice_to_audio.py）
   # 由 Agent 内部模型输出并落盘；本地不需要额外调用 LLM API。
   ```

   得到 `*-blog-voice.md` 后，**审阅、必要时手工编辑**；确保正文已用 `## 正文` + `### 第 N 条` 分条。

2. **第二步**：文字稿确认后，再生成 **MP3**（TTS 编译）：

   ```bash
   # 原子能力脚本 B：把口播文字稿拆成 opening/news-*/ending，并分别合成音频
   python scripts/tts_split_voice_to_audio.py <*-blog-voice.md> --out-dir ai-daily/runs/<runId>/audio
   ```

   （需本机已配置火山 TTS 凭证。）

3. **第三步（原子能力 C）**：构建 Remotion props（写入 `ai-daily/runs/<runId>/daily.json`）：

   ```bash
   python scripts/build_remotion_daily_props.py \
     --report-md ai-daily/runs/<runId>/ai-daily-<主题>-YYYY-MM-DD.md \
     --audio-dir ai-daily/runs/<runId>/audio \
     --out-json ai-daily/runs/<runId>/daily.json
   ```

4. **第四步：生成视频（Remotion 渲染）**：

   ```bash
   cd ai-daily/remotion-daily
   npx remotion render src/index.tsx DailyVideo ../runs/<runId>/final.mp4 \
     --props ../runs/<runId>/daily.json \
     --overwrite
   ```
