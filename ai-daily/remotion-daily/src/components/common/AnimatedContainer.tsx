import React from 'react';
import { useSlideFade, useSpringScale } from '../../utils/useAnimation';

interface AnimatedContainerProps {
  children: React.ReactNode;
  animation?: 'slide-fade' | 'spring-scale' | 'fade';
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const AnimatedContainer: React.FC<AnimatedContainerProps> = ({
  children,
  animation = 'slide-fade',
  delay = 0,
  style = {},
}) => {
  const slideFade = useSlideFade(0.5, 0.3, 50, delay);
  const scale = useSpringScale(delay);
  const opacity = useSlideFade(0.5, 0.3, 0, delay).opacity;

  let animationStyle: React.CSSProperties = {};

  switch (animation) {
    case 'slide-fade':
      animationStyle = {
        opacity: slideFade.opacity,
        transform: `translateY(${slideFade.y}px)`,
      };
      break;
    case 'spring-scale':
      animationStyle = {
        transform: `scale(${scale})`,
      };
      break;
    case 'fade':
      animationStyle = {
        opacity,
      };
      break;
  }

  return (
    <div style={{ ...animationStyle, ...style }}>
      {children}
    </div>
  );
};
