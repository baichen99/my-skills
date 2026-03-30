import React from 'react';

interface TextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';
  color?: string;
  weight?: 'normal' | 'medium' | 'bold' | 'extrabold';
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  color = '#ffffff',
  weight = 'normal',
  style = {},
  children,
}) => {
  const baseStyles: React.CSSProperties = {
    margin: 0,
    padding: 0,
    color,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    h1: {
      fontSize: 96,
      fontWeight: weight === 'extrabold' ? 900 : 700,
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: 56,
      fontWeight: weight === 'extrabold' ? 800 : 700,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: 36,
      fontWeight: weight === 'extrabold' ? 700 : 600,
      lineHeight: 1.3,
    },
    body: {
      fontSize: 32,
      fontWeight: weight === 'bold' ? 600 : 400,
      lineHeight: 1.6,
    },
    caption: {
      fontSize: 24,
      fontWeight: weight === 'bold' ? 500 : 400,
      lineHeight: 1.5,
    },
    label: {
      fontSize: 20,
      fontWeight: 500,
      lineHeight: 1.4,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
  };

  const weightMap: Record<string, number> = {
    normal: 400,
    medium: 500,
    bold: 700,
    extrabold: 900,
  };

  return (
    <p
      style={{
        ...baseStyles,
        ...variantStyles[variant],
        fontWeight: weightMap[weight],
        ...style,
      }}
    >
      {children}
    </p>
  );
};
