# 语音稿、停顿与录音

## 重要：不要直接朗读「结构化日报」

日报里的 `今日资讯` 含列表、`- 原文：URL` 等，**不适合直接送进 TTS**（会念链接、语气像读文档）。

## 强制顺序：先文字稿，再录音

1. **定稿日报**（且已按 [08-timeliness-and-filters.md](08-timeliness-and-filters.md) 过滤「今日」）
2. **只生成口播文字稿**（`*.md`，不合成音频）：

   ```bash
   # 由技能内大模型直接生成口播文字稿（不需要外部 LLM API 调用）
   # 产出：`ai-daily-<主题>-YYYY-MM-DD-blog-voice.md`
   ```

   得到 `*-blog-voice.md` 后，**检查措辞、分段、有无误读**；需要可手工编辑该文件。

   （可选 fallback/对照：自动兜底脚本 `scripts/daily_to_blog_voice.py` 已删除；如需口播文字稿请手工编写或由模型直接生成后再合成。）

3. **再生成录音**（文字稿确认无误后）：

   `python scripts/voice_to_audio.py <文字稿.md> -o <输出.mp3>`。

若你走“技能内大模型生成口播”，仍应遵守**先完成第 2 步再执行第 3 步**，避免未审稿就定稿音频。

口播生成方式（强制）：

- 首选：技能内大模型生成 `*-blog-voice.md`（仍需人工/Agent 审阅）
- 或手工编写：必须按模板要求，确保 `## 正文` 下用 `### 第一条 / ### 第二条 ...` 分段，便于 TTS 插入停顿

---

在「仅手工写口播」时，仍可按下面规范写**只用于朗读**的语音稿：口语短句，链接放到附录。

**文件名建议**：`ai-daily-<主题>-YYYY-MM-DD-blog-voice.md`（或保持 `*-blog-voice.md` 风格）。

## 写作要点

- 用「你、我们、今天」等口语主语；避免书面长从句，**一句一意**，便于断句与换气。
- **正文不要出现裸 URL** 与 `[文字](链接)`；若需提示听众，用「详情见本期 show notes」等固定说法。
- 每条新闻建议结构：**过渡语**（可选）→ **点出分类与事实** → **一句解读或影响** → **收束**。
- 用空行分段表示**长停顿**；短停顿用逗号、顿号，避免难读符号堆砌。
- 为让听感更“像主持人”，建议让过渡语与解读句承担大模型的优势：避免重复的固定轮换短语。
- **附录「链接与出处」** 独占一节：与日报同序编号，每条一行 `序号. 标题 — 原文链接`，供剪辑字幕或简介栏使用；**本段默认不送入 TTS**。

## 新闻之间的停顿（必选结构）

为使听感有节奏、条与条可区分，语音稿 **正文**须用 Markdown 三级标题分段：

- `## 正文` 下每一条新闻单独一个小节：`### 第一条`、`### 第二条` …（或等价标题，**必须以 `###` 开头**）。
- 脚本 `voice_to_audio.py` 会识别多个 `###` 小节，在**小节与小节之间**自动插入 SSML `<break time="…ms"/>`（默认 **900ms**，可用环境变量 `VOLC_TTS_PAUSE_MS` 或 `--pause-ms` 调整）。
- **开场白**、**各条正文**、**收尾**之间也会插入停顿（同一段 `break` 链），保证「开场 → 多条新闻 → 收尾」层次清晰。

若正文只有一段、没有 `###` 分条，则退化为**纯文本合成**（无条间 SSML 停顿）。

## 自动导出 MP3（执行要求）

语音稿保存后**必须**在同一工作目录执行合成（或由自动化脚本调用），生成与 `.md` 同主文件名的 **`.mp3`**：

```bash
# 在 my-skills/ai-daily 目录下：
python scripts/voice_to_audio.py ai-daily-<主题>-YYYY-MM-DD-blog-voice.md -o ai-daily-<主题>-YYYY-MM-DD-blog-voice.mp3
```

**产出阶段约定**：Agent 在完成 `*-blog-voice.md` 后**紧接着**运行 `python scripts/voice_to_audio.py ...`，除非用户明确只要文稿不要音频。

### 凭证

需配置 `VOLC_TTS_APPID` 与 `VOLC_TTS_ACCESS_TOKEN`（环境变量或 `settings.json` 顶层 / `volc_tts` 嵌套）。说明与故障排查见 [README.md](../README.md)。

强制预检（用于避免“没生成音频但流程还继续”）：

1. 在执行 `python scripts/voice_to_audio.py ...` 之前，必须确认 `ai-daily/settings.json` 文件存在且可读，且能解析出至少 `VOLC_TTS_APPID`、`VOLC_TTS_ACCESS_TOKEN`（或 `volc_tts.appid` / `volc_tts.access_token`）。
2. 只要预检失败：停止音频生成，并在输出中写明“缺少 TTS 凭证/未读取到 settings.json”，不要继续生成 `*.mp3` 和后续依赖音频的结果。

提醒：`scripts/voice_to_audio.py` 会从仓库内 `ai-daily/settings.json`（相对 `scripts/voice_to_audio.py` 的上级目录）加载配置，或优先使用环境变量 `VOLC_TTS_*`。

接口为火山 [OpenSpeech HTTP TTS](https://www.volcengine.com/docs/6561/1257584)（`Authorization: Bearer;token`），[鉴权](https://www.volcengine.com/docs/6561/107789)。若需 [语音合成大模型 2.0](https://www.volcengine.com/docs/6561/1257543) 全量能力，请按官方文档使用 **V3** 或控制台已授权音色。

### 命令行选项摘要

| 选项 | 含义 |
|------|------|
| `--plain` | 禁用 SSML，整稿纯文本切分（无条间停顿） |
| `--pause-ms N` | 条间停顿时长（毫秒） |
| `-o path` | 输出音频路径 |

## 模板与示例

完整示例见 `examples/voice-script-sample.md`。

**最小模板**：

```markdown
# 信息源口播稿 - YYYY-MM-DD

## 元信息
- **主题**：<主题>
- **预估时长**：约 N 分钟

## 开场白
<2～4 句>

## 正文

### 第一条
<口语段落，对应日报第 1 条>

### 第二条
<口语段落，对应日报第 2 条>

## 收尾
<1～3 句>

## 附录：链接与出处
> 不送入 TTS；与日报同序。
1. <标题> — <原文URL>
2. <标题> — <原文URL>
```
