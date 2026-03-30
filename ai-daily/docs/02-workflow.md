# 流水线（Workflow）

## 阶段总览

1. **准备阶段**
   - 确认主题、时间范围、条数上限
   - 检查来源可访问性（快速探测）
2. **抓取阶段**
   - 默认使用 Agent Browser 抓取所有来源
   - 仅对明确静态/RSS 来源使用 WebFetch（可选优化）
   - 新站点先 **Discovery**（探索阶段可大胆用搜索、类比 recipe、多 URL 试探；仍须落盘验证），再写定稿 recipe（见 [03-fetch-and-recipes.md](03-fetch-and-recipes.md)）
3. **清洗阶段**
   - URL 归一化（去追踪参数）
   - **时效过滤（与「今日」对齐）**：见 [08-timeliness-and-filters.md](08-timeliness-and-filters.md)。对每条候选核对 **原文/Feed 发布日期** 是否在用户约定窗口内；**禁止**因「出现在列表前排」「Trending」即视为今日新事。
   - **首轮解析原文链接**：能直接从列表/RSS 拿到的 `sourceUrl` 先写入；拿不到或不确定的条目**不要硬编**，进入下一阶段
   - 去重（以 **canonical 原文 URL** 为主，辅以高度相似标题）
   - 过滤低价值项（广告、活动页、无正文）
4. **补链与校验阶段（批量，强制纳入流程）**
   - **现实情况**：不少聚合页**根本不给出外站链接**，或只在详情里才有，**无法仅靠 recipe 多配几个字段就 100% 覆盖**；因此首轮抓取结束后，必须对**缺链、疑链**条目做**第二轮批量处理**
   - **处理对象**（至少包含）：无 `sourceUrl` / 链接缺失；`url` 仍落在聚合站域名下；标题与链接明显不匹配
   - **手段**（按成本从低到高选用）：用已有 `url` 打开**详情页**再抽「原文/来源」、外链与 JSON-LD；跟随重定向看落地域名；必要时用标题 + 站点内搜索或可信检索补一条可核验的外站 URL
   - **收口**：每条成稿前要么有**可点击即达原文**的 URL，要么在摘要中注明「原文链接未解析」并尽量保留聚合页作为次选（见 [04-daily-output.md](04-daily-output.md)）
5. **分析阶段**
   - 按主题分类
   - 生成中文摘要（1-2 句）
   - 评估优先级并排序
   - **再次核对日期**：成稿前删除窗口外条目，保证「今日资讯」名副其实（见 [08-timeliness-and-filters.md](08-timeliness-and-filters.md)）
6. **产出阶段**
   - 按模板生成日报 Markdown（见 [04-daily-output.md](04-daily-output.md)）
   - 保存到 `ai-daily-[subject]-YYYY-MM-DD.md`
   - 自动调用 `scripts/render_report_html.py` 生成同名 HTML 文件
   - **语音链路**：须**分两步**（见 [06-voice-and-audio.md](06-voice-and-audio.md)）：① 先生成并确认**口播文字稿** `*-blog-voice.md`；② 再调用 `export_voice_mp3.py` / `voice_to_audio.py` 生成 `.mp3`。**禁止**在未确认文字稿前仅依赖一键合成。
   - 给出「抓取失败清单 + 原因」；若有因日期剔除的条目，可附「排除原因：非窗口内发布」

## 相关文档

- 原文链接规则：[05-links-and-aggregation.md](05-links-and-aggregation.md)
- 时效与「今日」过滤：[08-timeliness-and-filters.md](08-timeliness-and-filters.md)
- Recipe / Discovery / 稳定性：[03-fetch-and-recipes.md](03-fetch-and-recipes.md)
