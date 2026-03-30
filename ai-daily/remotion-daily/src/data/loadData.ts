import { z } from 'zod';
import { dailyDataSchema, DailyData } from './schema';

/**
 * 从本地JSON文件加载日报数据
 * @param filePath JSON文件路径
 */
export const loadDailyData = async (filePath: string): Promise<DailyData> => {
  try {
    const data = await import(filePath);
    const validated = dailyDataSchema.parse(data.default || data);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('数据格式验证失败:', error.issues);
    }
    throw new Error(`加载数据失败: ${(error as Error).message}`);
  }
};

/**
 * 计算总视频时长（帧数）
 * @param data 日报数据
 * @param fps 帧率
 */
export const calculateTotalDuration = (data: DailyData, fps: number): number => {
  const titleDuration = (data.openingDuration ?? 5) * fps;
  const newsDuration = data.news.reduce((sum, news) => sum + news.duration * fps, 0);
  const transitionDuration = 0; // 时长对齐口播，转场不通过重叠时长延长总时长
  const endingDuration = (data.endingDuration ?? 3) * fps;

  return titleDuration + newsDuration + transitionDuration + endingDuration;
};
