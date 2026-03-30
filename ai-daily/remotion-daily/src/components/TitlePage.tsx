import { AbsoluteFill, useVideoConfig } from 'remotion';
import type { DailyData } from '../data/schema';
import { GradientBackground, AnimatedContainer, Text } from './common';
import { useFadeInOut } from '../utils/useAnimation';

interface TitlePageProps {
  data: DailyData;
  durationInFrames: number;
}

export const TitlePage: React.FC<TitlePageProps> = ({ data }) => {
  const { durationInFrames } = useVideoConfig();
  const fadeOut = useFadeInOut(0, 0.5);

  const keyFacts = data.news
    .slice(0, 3)
    .map((n) => {
      const summaryFirst =
        n.summary
          ?.split(/[。！？!?]/)
          .map((s) => s.trim())
          .filter(Boolean)[0] ?? '';

      const fact = summaryFirst ? `${n.title}：${summaryFirst}` : n.title;
      return `${n.category ? `${n.category} · ` : ''}${fact}`;
    })
    .filter(Boolean);

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <GradientBackground
        primaryColor={data.theme.primaryColor}
        secondaryColor={data.theme.backgroundColor}
      />
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 100px',
        }}
      >
        <AnimatedContainer animation="spring-scale" delay={0}>
          <div
            style={{
              padding: '12px 32px',
              backgroundColor: `${data.theme.primaryColor}20`,
              border: `1px solid ${data.theme.primaryColor}40`,
              borderRadius: '999px',
              marginBottom: 32,
            }}
          >
            <Text variant="label" color={data.theme.primaryColor} weight="medium">
              每日科技前沿
            </Text>
          </div>
        </AnimatedContainer>

        <AnimatedContainer animation="slide-fade" delay={0.2}>
          <Text variant="h1" color={data.theme.primaryColor} weight="extrabold" style={{ marginBottom: 24, textAlign: 'center' }}>
            {data.title}
          </Text>
        </AnimatedContainer>

        {data.subtitle && (
          <AnimatedContainer animation="slide-fade" delay={0.4}>
            <Text variant="h3" color={data.theme.textColor} style={{ marginBottom: 48, textAlign: 'center', opacity: 0.9 }}>
              {data.subtitle}
            </Text>
          </AnimatedContainer>
        )}

        <AnimatedContainer animation="slide-fade" delay={0.6}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 2,
                backgroundColor: data.theme.primaryColor,
              }}
            />
            <Text variant="caption" color={data.theme.secondaryColor} weight="medium">
              {data.date}
            </Text>
            <div
              style={{
                width: 40,
                height: 2,
                backgroundColor: data.theme.primaryColor,
              }}
            />
          </div>
        </AnimatedContainer>

        {/* 首屏要点：避免用户在开场仍未读完就“看不到信息” */}
        {keyFacts.length > 0 && (
          <AnimatedContainer animation="slide-fade" delay={0.85}>
            <div
              style={{
                width: '100%',
                maxWidth: 1100,
                marginTop: 48,
                padding: '22px 26px',
                backgroundColor: `${data.theme.backgroundColor}80`,
                border: `1px solid ${data.theme.primaryColor}30`,
                borderRadius: 20,
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}
            >
              <Text variant="label" color={data.theme.primaryColor} weight="medium">
                今日关键信息
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {keyFacts.map((f, i) => (
                  <Text
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    variant="caption"
                    color={data.theme.textColor}
                    weight="medium"
                    style={{ fontSize: 22, lineHeight: 1.35, opacity: 0.95 }}
                  >
                    {f}
                  </Text>
                ))}
              </div>
            </div>
          </AnimatedContainer>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
