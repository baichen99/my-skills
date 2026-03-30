import { AbsoluteFill } from 'remotion';
import type { DailyData } from '../data/schema';
import { GradientBackground, AnimatedContainer, Text } from './common';
import { useSpringScale, useFadeInOut } from '../utils/useAnimation';

interface EndingPageProps {
  data: DailyData;
  durationInFrames: number;
}

export const EndingPage: React.FC<EndingPageProps> = ({ data }) => {
  const scale = useSpringScale(0);
  const opacity = useFadeInOut(0.3);

  return (
    <AbsoluteFill style={{ opacity }}>
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
          transform: `scale(${scale})`,
        }}
      >
        <AnimatedContainer animation="spring-scale" delay={0}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: `${data.theme.primaryColor}20`,
              border: `3px solid ${data.theme.primaryColor}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 40,
            }}
          >
            <Text variant="h2" color={data.theme.primaryColor} weight="bold">
              AI
            </Text>
          </div>
        </AnimatedContainer>

        <AnimatedContainer animation="slide-fade" delay={0.2}>
          <Text variant="h2" color={data.theme.primaryColor} weight="extrabold" style={{ marginBottom: 24 }}>
            感谢观看
          </Text>
        </AnimatedContainer>

        <AnimatedContainer animation="slide-fade" delay={0.4}>
          <Text variant="h3" color={data.theme.textColor} style={{ marginBottom: 16, opacity: 0.9, textAlign: 'center' }}>
            每日更新，聚焦 AI 领域最新动态
          </Text>
        </AnimatedContainer>

        <AnimatedContainer animation="slide-fade" delay={0.6}>
          <div
            style={{
              marginTop: 64,
              paddingTop: 24,
              borderTop: `1px solid ${data.theme.primaryColor}30`,
            }}
          >
            <Text variant="caption" color={data.theme.secondaryColor}>
              © {new Date(data.date).getFullYear()} AI 日报
            </Text>
          </div>
        </AnimatedContainer>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
