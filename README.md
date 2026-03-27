# Personal Skills Hub

这是你的个人 skills 总览入口，用于快速定位每个技能目录的用途与入口文件。

## Skills Index

- `ai-daily`：聚合多来源信息，生成中文日报（Markdown + HTML）
  - 入口：`ai-daily/SKILL.md`
  - 说明：`ai-daily/README.md`

## 目录约定

每个 skill 建议遵循统一结构：

```text
<skill-name>/
├── SKILL.md        # 技能定义与执行规范（必需）
├── README.md       # 补充说明、脚本用法、示例（推荐）
├── scripts/        # 辅助脚本（可选）
└── site-recipes/   # 站点/来源配置（按需）
```

## 使用建议

- 优先从本文件定位目标 skill，再进入对应目录阅读 `SKILL.md`
- 若 skill 含脚本，先看该目录的 `README.md` 再执行
- 新增 skill 后，记得更新本索引，保持可发现性
