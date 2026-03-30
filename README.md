# AI Daily

这是你个人 **skills 集合**中的一个子技能目录，不是独立应用仓库。

该技能用于聚合多来源资讯、生成中文日报，并导出美观 HTML。

## 在 skills 集合中的定位

- 本目录聚焦 `ai-daily` 这一条能力链路
- 与其他 skills 并列存在于你的 skills 根目录下
- 约定：技能入口在 `SKILL.md`，**分环节说明**在 `docs/*.md`，辅助脚本放在 `scripts/`，抓取配置放在 `site-recipes/`

## 功能

- 聚合多个信息源（站点、RSS、趋势页等）
- 通过 `site-recipes` 管理抓取配置
- 生成日报 Markdown（可配合技能流程自动产出）
- 使用零第三方依赖脚本将 Markdown 渲染为单文件 HTML
- 提供信息源管理脚本（新增/列出/校验 recipe）

## 目录结构

```text
ai-daily/
├── SKILL.md
├── docs/
│   ├── 01-overview.md … 07-pitfalls.md
├── README.md
├── .gitignore
├── scripts/
│   ├── render_report_html.py
│   ├── daily_to_blog_voice.py
│   ├── voice_to_audio.py
│   ├── export_voice_mp3.py
│   └── feed_submitter.py
└── site-recipes/
    ├── readhub-daily.yaml
    ├── readhub-ai.yaml
    ├── juya-ai-daily.yaml
    └── ...
```

## 环境要求

- Python 3.10+（推荐）
- `scripts/render_report_html.py`：仅 Python 标准库，无第三方依赖
- `scripts/feed_submitter.py`：依赖 `PyYAML`

安装 `PyYAML`：

```bash
python -m pip install pyyaml
```

## 快速开始

### 1) 生成 HTML 报告

将已有日报 Markdown 渲染为 HTML：

```bash
python scripts/render_report_html.py ai-daily-农业领域-2026-03-27.md
```

自定义输出文件名：

```bash
python scripts/render_report_html.py ai-daily-农业领域-2026-03-27.md -o ai-daily-农业领域-2026-03-27.html
```

### 2) 管理信息源

新增一个信息源（自动创建基础 recipe）：

```bash
python scripts/feed_submitter.py add "https://example.com/rss.xml" --name "示例源"
```

列出所有已配置来源：

```bash
python scripts/feed_submitter.py list
```

校验某个 recipe：

```bash
python scripts/feed_submitter.py verify readhub-daily
```

## Site Recipe 说明

`site-recipes/*.yaml` 用于描述每个来源的访问与提取规则，建议至少包含：

- `id`, `name`
- `access.url`, `access.needsBrowser`, `access.waitFor`
- `extraction.listSelector`, `extraction.fields.title`, `extraction.fields.url`
- 对聚合类来源：尽量配置 `extraction.fields.sourceUrl`（或 `originalUrl`）；**页面上没有稳定外站链接时，配置也拿不到**，须在首轮抓取后按 `SKILL.md` 做**批量补链与校验**，不能单靠加字段解决。

新增来源后，建议立刻执行一次 `verify` 并手动测试选择器是否可用。

## 日报 Markdown 格式

「今日资讯」中每条为单行：`序号.【分类】摘要 [原文](原文URL)`。HTML 由 `scripts/render_report_html.py` 从该 Markdown 生成。

收录前须核对**原文发布日期**是否在约定「今日/24h」窗口内，避免混入旧闻，见 [docs/08-timeliness-and-filters.md](docs/08-timeliness-and-filters.md)。

## 语音稿 Markdown

详见 [docs/06-voice-and-audio.md](docs/06-voice-and-audio.md)。**顺序：先口播文字稿（.md），确认后再生成录音（.mp3）。**

### 从结构化日报生成博客口播稿（推荐）

**不要**把带「原文 URL」的日报直接送进 TTS。

```bash
# 1）只生成文字稿
python scripts/daily_to_blog_voice.py ai-daily-frontend-2026-03-30.md
# 2）审阅 *-blog-voice.md 后，再合成 MP3
python scripts/export_voice_mp3.py ai-daily-frontend-2026-03-30-blog-voice.md
```

一键（不推荐跳过审稿）：`python scripts/daily_to_blog_voice.py your-daily.md --audio`

默认在同目录生成 `*-blog-voice.md`（正文无链接、带口语过渡与小结；链接只在附录）。

### 手工口播稿

要点：**`## 正文` 下用 `### 第一条`、`### 第二条`… 分条**，合成时会在条间插入 SSML 停顿。示例见 `examples/voice-script-sample.md`。

### 生成录音（火山 OpenSpeech HTTP TTS）

脚本：`scripts/voice_to_audio.py`；一键封装：`scripts/export_voice_mp3.py`（默认输出与 `.md` 同主文件名的 `.mp3`）。

接口与 [鉴权](https://www.volcengine.com/docs/6561/107789)、[HTTP TTS](https://www.volcengine.com/docs/6561/1257584) 一致；[大模型语音合成](https://www.volcengine.com/docs/6561/1257543) 需在控制台开通对应资源。

1. 复制 `settings.example.json` 为 `settings.json`，填入凭证；或设置环境变量 `VOLC_TTS_APPID`、`VOLC_TTS_ACCESS_TOKEN`。
2. **文字稿定稿后**再合成（示例）：

```bash
python scripts/export_voice_mp3.py examples/voice-script-sample.md
python scripts/voice_to_audio.py examples/voice-script-sample.md -o examples/voice-script-sample.mp3
```

依赖：`voice_to_audio.py` 仅 Python 标准库（`urllib`），无 PyPI 依赖。

**若报错 `code 3001` 且含 `volc.seedtts.default` / `requested resource not granted`：** 表示未开通或未授权「语音合成大模型（Seed TTS）」。请到 [火山控制台](https://console.volcengine.com/) → 豆包语音，为应用开通**语音合成大模型**并完成授权；或暂时用 `--voice zh_male_M392_conversation_wvae_bigtts` 等控制台已授权音色重试。详见 [产品简介](https://www.volcengine.com/docs/6561/1257543)。

## 常见问题

- **HTML 渲染失败：** 先确认输入 Markdown 文件路径是否正确。
- **feed_submitter 报错 `No module named yaml`：** 安装 `PyYAML`。
- **抓取不到内容：** 优先检查 recipe 的 `listSelector` 和字段选择器是否过期。
- **TTS 403 / `requested resource not granted`：** 见上文「生成录音」中的 Seed TTS 说明；并确认 `settings.json` 未被误提交（已加入 `.gitignore`）。

## License

内部项目，按你的仓库策略使用。
