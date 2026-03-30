import { z } from 'zod';
import { zColor } from '@remotion/zod-types';

/** 与 theme 字段默认值一致；勿用 `.default({})`，否则 Zod 会解析出空对象且不会套用子字段 default */
export const DEFAULT_THEME = {
  primaryColor: '#165DFF',
  secondaryColor: '#4080FF',
  backgroundColor: '#0F172A',
  textColor: '#FFFFFF',
} as const;

export const newsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  category: z.string().optional(),
  coverImage: z.string().optional(),
  source: z.string().optional(),
  publishTime: z.string().optional(),
  tags: z.array(z.string()).optional(),
  audio: z.string().optional(), // 新闻语音播报音频路径
  duration: z.number().default(10), // 默认展示10秒
});

export const dailyDataSchema = z.object({
  date: z.string(),
  title: z.string().default('AI 日报'),
  subtitle: z.string().optional(),
  news: z.array(newsItemSchema),
  // 这里复用你现有的字段名：`backgroundAudio` 实际是片头开场口播音频（voice）
  backgroundAudio: z.string().optional(),
  // 片头开场音频对应的秒数，用于把画面时长对齐到口播音频
  openingDuration: z.number().optional(),
  // 片尾口播音频，用于结尾语音
  endingAudio: z.string().optional(),
  // 片尾口播音频对应的秒数，用于把画面时长对齐到口播音频
  endingDuration: z.number().optional(),
  theme: z
    .object({
      primaryColor: zColor().default(DEFAULT_THEME.primaryColor),
      secondaryColor: zColor().default(DEFAULT_THEME.secondaryColor),
      backgroundColor: zColor().default(DEFAULT_THEME.backgroundColor),
      textColor: zColor().default(DEFAULT_THEME.textColor),
    })
    .default({ ...DEFAULT_THEME }),
});

export type NewsItem = z.infer<typeof newsItemSchema>;
export type DailyData = z.infer<typeof dailyDataSchema>;
export type DailyDataInput = z.input<typeof dailyDataSchema>;

/** 合并 Zod 默认值（含 theme），避免 Remotion 未传 theme 时运行时报错 */
export const parseDailyData = (input: unknown): DailyData => dailyDataSchema.parse(input);
