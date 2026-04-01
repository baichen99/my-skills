---
name: ai-daily
description: Use when producing a daily brief by aggregating multiple regularly-updated sources (RSS, news sites, trending pages), then deduplicating, summarizing, and writing a dated Markdown report file; filter by publication date for "today"; write chat-send.txt with full URLs per item; when user adds supplementary article/social links, sync report, news.json, voice script, audio, and chat-send; optionally voice script then MP3 via Volcengine TTS.
---

# AI Daily

技能说明已**按环节拆成多篇 Markdown**，执行时按需打开对应文件（路径均相对于 **`ai-daily/`** 目录）。

| 环节 | 文档 |
|------|------|
| 总览、触发条件、质量要求 | [docs/01-overview.md](docs/01-overview.md) |
| 流水线（准备→产出） | [docs/02-workflow.md](docs/02-workflow.md) |
| Recipe、Discovery、抓取与稳定性 | [docs/03-fetch-and-recipes.md](docs/03-fetch-and-recipes.md) |
| 日报结构、模板、**聊天框链接**、**补充来源同步**、HTML 导出 | [docs/04-daily-output.md](docs/04-daily-output.md) |
| 原文链接与聚合页 | [docs/05-links-and-aggregation.md](docs/05-links-and-aggregation.md) |
| **语音：先文字稿，再录音** | [docs/06-voice-and-audio.md](docs/06-voice-and-audio.md)（口播稿：技能内大模型生成；如需录音仅保留 `scripts/voice_to_audio.ts`） |
| 常见错误与备注 | [docs/07-pitfalls.md](docs/07-pitfalls.md) |
| **「今日」时效与过滤** | [docs/08-timeliness-and-filters.md](docs/08-timeliness-and-filters.md) |

仓库内脚本与目录说明见 [README.md](README.md)。

**新站点 Discovery**：探索阶段宜**大胆**——善用 Web/站内搜索、仓库内检索与类比已有 `site-recipes`；多 URL、多交互试探后再收敛选择器；**仍须**保存 YAML 并验证（见 [docs/03-fetch-and-recipes.md](docs/03-fetch-and-recipes.md)「Discovery Mode」）。

## 产出阶段速记（必须）

### 执行约束：强制从抓取开始（禁止复用）

每次收到任务时，都必须按工作流从“获取数据→生成日报→口播稿→合成音频→生成视频”重新跑一遍，不得复用任何先前已经产出的同日期中间文件/结果。

抓取阶段要求：禁止用任何“抓取并直接生成视频”的全流程脚本（例如 `scripts/run_ai_daily_to_video.ts`）；抓取与补链由 Agent Browser 交互完成，产物只落在 `runs/<runId>/` 记录目录中。

为避免“复用旧结果导致未更新”的情况，执行前应至少满足以下任一策略（两者可叠加）：

- 若存在目标 `runs/<runId>/` 记录目录，则先删除或强制覆盖后再生成。
- 渲染视频前，必须保证 `ai-daily/runs/<runId>/daily.json` 是本次运行生成的“新数据文件”，且其 `news.audio/backgroundAudio/endingAudio` 字段指向本次运行生成并可被 Remotion 访问的音频资源（本方案使用 base64 data URI，降低访问路径依赖）。

### 日报与 HTML

1. 定稿日报：`ai-daily/runs/<runId>/ai-daily-<主题>-YYYY-MM-DD.md`（其中 `runId` 默认形如 `daily-<topic>-YYYY-MM-DD-HHMMSS`；收录前须按 [08-timeliness-and-filters.md](docs/08-timeliness-and-filters.md) 过滤**原文发布日期**在窗口内，避免旧闻混入「今日」）。
2. **聊天框发送稿（强制）**：同目录 `chat-send.txt`（或用户指定名）——「今日重点」与「资讯摘要」**每条须含完整可点击 URL**，与日报序号、`news.json`、`news-N.mp3` 对齐；规范见 [docs/04-daily-output.md](docs/04-daily-output.md)「聊天框发送格式」。
3. **用户补充链接（强制同步）**：用户追加知乎/X/博客等来源时，须同步更新日报、`news.json`、口播分段、**重跑** `run.ts audio`、更新 `chat-send.txt`；不得只改 Markdown。见 [docs/04-daily-output.md](docs/04-daily-output.md)「用户补充来源时的同步规则」。
4. HTML 导出脚本可选使用 `scripts/render_report_html.ts`：视频链路本身不依赖 HTML。

### 口播：先文字稿，再录音（禁止颠倒）

1. **第一步（推荐）**：由技能内大模型直接读取定稿日报，生成**口播文字稿**（仅生成 `.md`，不生成音频）：

   ```bash
   # 生成目标：`*-blog-voice.md`（结构必须兼容 voice_to_audio.ts）
   # 由 Agent 内部模型输出并落盘；本地不需要额外调用 LLM API。
   ```

   得到 `*-blog-voice.md` 后，**审阅、必要时手工编辑**；确保正文已用 `## 正文` + `### 第 N 条` 分条。

2. **第二步**：文字稿确认后，再生成 **MP3**（TTS 编译）：

   ```bash
   # 原子能力脚本 B：把口播文字稿拆成 opening/news-*/ending，并分别合成音频
   bun ai-daily/scripts/run.ts audio <*-blog-voice.md> --out-dir ai-daily/runs/<runId>/audio
   ```

   （需本机已配置火山 TTS 凭证。）

3. **第三步（原子能力 C）**：先由 Agent 生成结构化 `news.json`，再构建 Remotion props（写入 `ai-daily/runs/<runId>/daily.json`）：

   `news.json` 由 Agent 生成，脚本只做校验与转换。最小结构如下：

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

   说明：
   - `date` 必须是 `YYYY-MM-DD`
   - `news[].idx` 从 1 开始递增，且与 `news-N.mp3` 对齐
   - 可选字段：`news[].title`、`news[].source`、`news[].publishTime`

   ```bash
   bun scripts/build_remotion_daily_props.ts \
     --news-json ai-daily/runs/<runId>/news.json \
     --audio-dir ai-daily/runs/<runId>/audio \
     --out-json ai-daily/runs/<runId>/daily.json
   ```

4. **第四步：生成视频（统一走 CLI，禁止直接写 Remotion 命令）**：

   ```bash
   # 推荐：按 runId 生成
   bun ai-daily/scripts/run.ts video --run-id <runId>

   # 或按 props 文件直接生成
   bun ai-daily/scripts/run.ts video \
     --props ai-daily/runs/<runId>/daily.json \
     --out ai-daily/runs/<runId>/final.mp4
   ```

5. **可选：一键端到端（audio -> props -> video）**：

   ```bash
   bun ai-daily/scripts/run.ts full \
     --voice-md ai-daily/<*-blog-voice.md> \
     --report-md ai-daily/runs/<runId>/ai-daily-<主题>-YYYY-MM-DD.md \
     --news-json ai-daily/runs/<runId>/news.json \
     --run-id <runId>
   ```

   默认会自动启动状态机看板并尝试打开浏览器展示执行过程。若不需要：

   ```bash
   bun ai-daily/scripts/run.ts full ... --no-ui
   # 或保留看板但不自动打开浏览器
   bun ai-daily/scripts/run.ts full ... --no-open
   ```

### 视频工程门禁（必须）

- 先检测并复用 `ai-daily/remotion-daily`，禁止执行 `bun create remotion`（或任何 init/new project 命令）。
- 若缺少 `ai-daily/remotion-daily/package.json` 或 `ai-daily/remotion-daily/src/index.tsx`，直接报错并停止，不允许自动新建项目。
- 视频阶段只允许调用 `bun ai-daily/scripts/run.ts video ...` 作为入口。

### 防幻觉执行协议（必须）

- 只允许调用以下入口：`bun ai-daily/scripts/run.ts audio|video|full ...`；禁止即兴编造新脚本名或新路径。
- 执行前先校验输入路径真实存在（`voice-md`、`report-md`、`news-json`、`runs/<runId>/`）；任一缺失时先报错，不得猜测补全。
- 若命令返回非 0，立即停止后续步骤并回传原始错误；不得“假设成功”继续渲染。
- 不允许使用“可能在某目录”的模糊表述，必须输出已解析的绝对路径或明确的相对路径。
- 若检测到多个候选 run 目录，先向用户确认 `runId`，不得自行猜测。
