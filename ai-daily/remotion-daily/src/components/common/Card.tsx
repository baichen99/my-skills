import React from 'react';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  padding?: 'none' | 'small' | 'medium' | 'large';
  elevation?: 'none' | 'small' | 'medium' | 'large';
  radius?: 'small' | 'medium' | 'large';
}

export const Card: React.FC<CardProps> = ({
  children,
  style = {},
  padding = 'medium',
  elevation = 'medium',
  radius = 'medium',
}) => {
  const paddingMap: Record<string, string> = {
    none: '0',
    small: '24px',
    medium: '40px',
    large: '64px',
  };

  const elevationMap: Record<string, string> = {
    none: 'none',
    small: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    medium: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    large: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  };

  const radiusMap: Record<string, string> = {
    small: '8px',
    medium: '16px',
    large: '24px',
  };

  return (
    <div
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        borderRadius: radiusMap[radius],
        boxShadow: elevationMap[elevation],
        padding: paddingMap[padding],
        border: '1px solid rgba(255, 255, 255, 0.1)',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
