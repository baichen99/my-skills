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
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${direction}, ${primaryColor}15, ${secondaryColor})`,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
