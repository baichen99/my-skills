import { Composition, registerRoot, CalculateMetadataFunction } from 'remotion';
import { DailyVideo } from './compositions/DailyVideo';
import { dailyDataSchema, DEFAULT_THEME, type DailyDataInput } from './data/schema';
import { calculateTotalDuration } from './data/loadData';

const calculateMetadata: CalculateMetadataFunction<DailyDataInput> = ({
  props,
  defaultProps,
}) => {
  const fps = 30;
  // 使用实际传入的 props 计算时长；props 可能缺少带 `.default(...)` 的字段
  // 因此这里先走一次 schema.parse，确保拿到 `DailyData`（title/theme 等必填字段已补齐）。
  const data = dailyDataSchema.parse(props ?? defaultProps);
  const durationInFrames = calculateTotalDuration(data, fps);

  return {
    durationInFrames,
    fps,
    width: 1920,
    height: 1080,
  };
};

const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="DailyVideo"
        component={DailyVideo}
        calculateMetadata={calculateMetadata}
        durationInFrames={1800} // 默认30秒
        fps={30}
        width={1920}
        height={1080}
        schema={dailyDataSchema}
        defaultProps={{
          date: '2026-03-30',
          title: 'AI 日报',
          subtitle: '聚焦人工智能领域最新动态',
          news: [],
          theme: { ...DEFAULT_THEME },
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
