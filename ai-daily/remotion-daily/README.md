# AI 日报视频生成工具

基于 Remotion 实现的自动化日报视频生成系统，可以将结构化的新闻数据自动转换为专业的视频内容。

## 功能特性

- 🎬 自动生成高质量日报视频，支持 1080p/30fps
- 📊 数据驱动，支持 JSON 格式数据输入
- 🎨 可定制主题和动画效果
- ⚡ 多线程渲染优化，支持硬件加速
- 🔄 完全自动化，可集成到 CI/CD 工作流
- 📱 支持横屏/竖屏多种输出格式

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式预览

```bash
npm run dev
```

打开浏览器访问 http://localhost:3000 即可预览视频效果，实时调整组件和动画。

### 3. 渲染示例视频

```bash
npm run render:example
```

渲染完成后视频将输出到 `output/example.mp4`。

### 4. 使用自定义数据渲染

```bash
# 方式1：命令行参数传入
npm run render:custom output/my-video.mp4 --props='{"date":"2026-03-30","news": [...]}'

# 方式2：使用JSON文件
npm run render -- --props=./path/to/your/data.json output/my-video.mp4

# 方式3：使用自动化脚本
./scripts/generate-daily-video.sh 2026-03-30 economy-daily # topic 可选，默认 daily
```

## 数据格式

输入的JSON数据需要符合以下格式：

```json
{
  "date": "2026-03-30",
  "title": "AI 日报",
  "subtitle": "聚焦人工智能领域最新动态",
  "news": [
    {
      "id": "1",
      "title": "新闻标题",
      "summary": "新闻摘要内容...",
      "category": "分类",
      "coverImage": "https://example.com/image.jpg",
      "source": "来源",
      "publishTime": "发布时间",
      "duration": 10
    }
  ],
  "theme": {
    "primaryColor": "#165DFF",
    "secondaryColor": "#4080FF",
    "backgroundColor": "#0F172A",
    "textColor": "#FFFFFF"
  }
}
```

## 项目结构

```
remotion-daily/
├── src/
│   ├── components/        # 通用视频组件
│   │   ├── TitlePage.tsx   # 标题页组件
│   │   ├── NewsCard.tsx    # 新闻卡片组件
│   │   └── EndingPage.tsx  # 片尾组件
│   ├── compositions/      # 视频组合定义
│   │   └── DailyVideo.tsx  # 主视频组合
│   ├── data/              # 数据处理
│   │   ├── schema.ts       # 数据结构定义
│   │   ├── loadData.ts     # 数据加载工具
│   │   └── example.json    # 示例数据
│   ├── utils/             # 工具函数
│   └── index.tsx          # 项目入口
├── scripts/               # 自动化脚本
│   ├── render.ts          # 编程式渲染脚本
│   └── generate-daily-video.sh # 全自动生成脚本
├── public/                # 静态资源
├── remotion.config.ts     # Remotion配置
└── tsconfig.json          # TypeScript配置
```

## 自定义和扩展

### 修改主题颜色

在数据的 `theme` 字段中配置颜色，支持所有CSS颜色格式。

### 添加新组件

在 `src/components/` 目录下创建新的React组件，使用Remotion提供的动画API实现帧精确的动画效果。

### 调整动画参数

组件中的动画参数（如入场时长、淡入淡出速度等）都可以直接在组件文件中修改。

## 渲染优化

### 本地渲染优化
- 使用 `--concurrency` 参数调整并发渲染线程数，建议设置为CPU核心数的75%
- 开启硬件加速：在 `remotion.config.ts` 中已经默认配置
- 使用缓存：添加 `--cache` 参数复用已渲染的帧

### 云渲染
对于长视频（>10分钟），建议使用Remotion Cloud或云函数实现分布式渲染，可以将渲染速度提升10倍以上。

## 自动化集成

### 和现有日报流程整合
在日报生成脚本执行完成后，调用 `generate-daily-video.sh` 脚本即可自动生成视频。

### CI/CD定时任务
可以配置GitHub Actions/GitLab CI每日定时执行，自动生成当日的日报视频。

## 常见问题

### 中文字体乱码
确保系统中安装了中文字体，或者在 `remotion.config.ts` 中配置自定义字体加载。

### 渲染速度慢
- 升级更高配置的机器
- 使用云渲染服务
- 降低视频分辨率或帧率

### 音画不同步
调整音频的 `offset` 属性，确保语音和画面时间对齐。

## 技术栈

- [Remotion](https://www.remotion.dev/) - 基于React的视频生成框架
- React 19 - UI框架
- TypeScript - 类型安全
- Zod - 数据验证
