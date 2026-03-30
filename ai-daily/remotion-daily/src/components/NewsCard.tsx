import { AbsoluteFill, Img } from 'remotion';
import type { NewsItem, DailyData } from '../data/schema';
import { GradientBackground, Text, Card } from './common';
import { useSlideFade } from '../utils/useAnimation';

interface NewsCardProps {
  news: NewsItem;
  theme: DailyData['theme'];
  durationInFrames: number;
  index: number;
}

export const NewsCard: React.FC<NewsCardProps> = ({ news, theme, index }) => {
  const { opacity, y } = useSlideFade();

  // 拆分摘要为要点（简单按句号拆分）
  const keyPoints = news.summary
    .split(/[。！？]/)
    .filter((point) => point.trim().length > 0)
    // 信息密度：给更多要点位
    .slice(0, 5);

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <GradientBackground
        primaryColor={theme.primaryColor}
        secondaryColor={theme.backgroundColor}
      />
      <AbsoluteFill style={{ padding: '64px 72px' }}>
        <Card padding="medium" elevation="large">
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              {/* 分类标签 */}
              {news.category && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '10px 28px',
                    backgroundColor: `${theme.primaryColor}20`,
                    border: `1px solid ${theme.primaryColor}40`,
                    borderRadius: '999px',
                  }}
                >
                  <Text variant="label" color={theme.primaryColor} weight="medium">
                    {news.category}
                  </Text>
                </div>
              )}

              <Text variant="caption" color={theme.secondaryColor} weight="medium">
                {news.publishTime || ''} · 第 {index + 1} 条
              </Text>
            </div>

            {/* 新闻标题 */}
            <Text variant="h2" color={theme.textColor} weight="bold" style={{ marginBottom: 24 }}>
              {news.title}
            </Text>

            {/* 来源 */}
            {news.source && (
              <Text variant="caption" color={theme.secondaryColor} style={{ marginBottom: 32 }}>
                来源：{news.source}
              </Text>
            )}
          </div>

          <div style={{ display: 'flex', gap: '40px', marginBottom: 32 }}>
            {/* 封面图 */}
            {news.coverImage && (
              <div style={{ flexShrink: 0, width: '40%' }}>
                <Img
                  src={news.coverImage}
                  style={{
                    width: '100%',
                    height: 300,
                    objectFit: 'cover',
                    borderRadius: '16px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                  }}
                />
              </div>
            )}

            {/* 核心要点 */}
            <div style={{ flex: 1 }}>
              <Text variant="h3" color={theme.primaryColor} weight="bold" style={{ marginBottom: 16 }}>
                核心要点
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {keyPoints.map((point, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: theme.primaryColor,
                        marginTop: 16,
                        flexShrink: 0,
                      }}
                    />
                    <Text
                      variant="body"
                      color={theme.textColor}
                      style={{ opacity: 0.95, lineHeight: '1.6', fontSize: 26 }}
                    >
                      {point.trim()}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 完整摘要 */}
          {/* 让信息量更多：只要摘要足够长就展示完整摘要（小字号） */}
          {news.summary.length > 110 && (
            <div
              style={{
                marginBottom: 24,
                padding: '20px',
                backgroundColor: 'rgba(15, 23, 42, 0.035)',
                borderRadius: '12px',
                border: `1px solid ${theme.primaryColor}18`,
              }}
            >
              <Text variant="body" color={theme.textColor} style={{ opacity: 0.86, fontSize: 24, lineHeight: '1.55' }}>
                {news.summary}
              </Text>
            </div>
          )}

          {/* 标签/关键词 - 如果有的话 */}
          {news.tags && news.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: 24 }}>
              {news.tags.map((tag, i) => (
                <div
                  key={i}
                  style={{
                    padding: '6px 16px',
                    backgroundColor: `${theme.primaryColor}15`,
                    borderRadius: '6px',
                  }}
                >
                  <Text variant="caption" color={theme.primaryColor}>
                    # {tag}
                  </Text>
                </div>
              ))}
            </div>
          )}
        </Card>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
