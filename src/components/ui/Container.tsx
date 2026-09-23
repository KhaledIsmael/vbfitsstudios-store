import React from 'react';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  size?: 'default' | 'narrow' | 'wide' | 'full';
  cleanGutter?: boolean;
}

export const Container: React.FC<ContainerProps> = ({
  as: Component = 'div',
  size = 'default',
  cleanGutter = false,
  className = '',
  children,
  ...props
}) => {
  const sizeStyles = {
    narrow: 'max-w-5xl',
    default: 'max-w-[1900px]',
    wide: 'max-w-[1900px]',
    full: 'max-w-full',
  }[size];

  // Conforms to measured gutters: 16px mobile (px-4), 32px desktop (sm:px-8)
  const gutterStyles = cleanGutter ? '' : 'px-4 sm:px-8';

  return (
    <Component
      className={`w-full mx-auto ${sizeStyles} ${gutterStyles} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};
