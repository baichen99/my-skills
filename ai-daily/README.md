# AI Daily

简版说明：这个目录用于生成日报、音频和视频，统一入口是 `scripts/run.ts`。

- 详细规范请看 `SKILL.md` 和 `docs/`
- 运行 `bun scripts/run.ts full ...` 仅执行命令行流水线（不再启动可视化看板）
- `full` 链路需要 `--news-json`（由 Agent 生成）；脚本只做验证与转换，不再从日报 Markdown 解析资讯
