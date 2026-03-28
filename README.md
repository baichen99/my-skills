# AI Daily

这是你个人 **skills 集合**中的一个子技能目录，不是独立应用仓库。

该技能用于聚合多来源资讯、生成中文日报，并导出美观 HTML。

## 在 skills 集合中的定位

- 本目录聚焦 `ai-daily` 这一条能力链路
- 与其他 skills 并列存在于你的 skills 根目录下
- 约定：技能说明在 `SKILL.md`，辅助脚本放在 `scripts/`，抓取配置放在 `site-recipes/`

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
├── README.md
├── .gitignore
├── scripts/
│   ├── render_report_html.py
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

新增来源后，建议立刻执行一次 `verify` 并手动测试选择器是否可用。

## 常见问题

- **HTML 渲染失败：** 先确认输入 Markdown 文件路径是否正确。
- **feed_submitter 报错 `No module named yaml`：** 安装 `PyYAML`。
- **抓取不到内容：** 优先检查 recipe 的 `listSelector` 和字段选择器是否过期。

## License

内部项目，按你的仓库策略使用。
