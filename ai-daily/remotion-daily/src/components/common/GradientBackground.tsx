import { AbsoluteFill } from 'remotion';
import React from 'react';

interface GradientBackgroundProps {
  primaryColor: string;
  secondaryColor?: string;
  direction?: 'to-right' | 'to-left' | 'to-bottom' | 'to-top' | 'to-bottom-right';
  opacity?: number;
  children?: React.ReactNode;
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({
  primaryColor,
  secondaryColor = '#0f172a',
  direction = 'to-bottom-right',
  opacity = 1,
  children,
}) => {
  // 强制使用浅色底，避免数据 theme/默认值导致“纯黑背景”观感问题。
  // （secondaryColor 仅用于作为潜在点缀颜色；背景主体固定浅色。）
  const base = '#F6F8FF';
  const base2 = '#EEF3FF';
  // 用单行 backgroundImage，避免 remotion/webpack 下 CSS 模板字符串解析差异。
  const bgImage = `radial-gradient(900px circle at 15% 15%, ${primaryColor}38 0%, transparent 60%), radial-gradient(700px circle at 85% 25%, ${primaryColor}26 0%, transparent 55%), linear-gradient(${direction}, ${base} 0%, ${primaryColor}10 40%, ${base2} 100%)`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: base,
        backgroundImage: bgImage,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
