# 常见错误与备注

## Common Mistakes

- 只给聚合页链接，未追溯原文链接
- **以为多配 recipe 字段就能拿到全部原文链接**，跳过首轮后的**批量补链与校验**（很多源根本不展示外站 URL）
- 页面是动态渲染却仍使用静态抓取
- 未按默认策略优先使用 Agent Browser
- 去重仅按标题，导致同一事件重复收录
- 【严重错误】访问新站点未执行 Discovery 模式、未生成/保存对应的 site recipe 文件
- 没有输出失败来源，造成「看起来都成功了」的错觉
- **语音稿正文未用 `###` 分条**，导致无法插入条间 SSML 停顿
- **未先确认文字稿就合成 MP3**，导致错误口播难以返工
- **把列表/热门/排序当作「今日」**，未核对原文发布日期，日报混入旧闻（见 [08-timeliness-and-filters.md](08-timeliness-and-filters.md)）
- **语音稿定稿后未运行** `voice_to_audio.ts`，缺少 MP3

## Notes

- Recipe 可自动生成，也可人工维护
- 若源站存在登录/验证码，需明确标注「需要人工介入」
- 建议每周抽样校验一次 recipe，防止站点结构变更导致静默失效
- 火山 TTS 若报 `requested resource not granted` / `seedtts`，需在控制台开通对应语音能力，见 README 故障说明
