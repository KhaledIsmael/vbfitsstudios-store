import React from 'react';

export interface SectionHeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  description?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  align?: 'left' | 'center' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  title,
  subtitle,
  description,
  as: HeadingTag = 'h2',
  align = 'center',
  size = 'md',
  className = '',
  ...props
}) => {
  const alignStyles = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  }[align];

  const titleSizes = {
    sm: 'text-sm sm:text-base',
    md: 'text-base sm:text-lg lg:text-xl',
    lg: 'text-lg sm:text-xl lg:text-2xl',
    hero: 'text-lg sm:text-2xl lg:text-[28.8px]',
  }[size];

  return (
    <div className={`flex flex-col ${alignStyles} ${className}`} {...props}>
      {subtitle && (
        <span className="text-[10px] sm:text-[11px] uppercase tracking-luxury text-[#767676] mb-1.5 font-sans font-medium">
          {subtitle}
        </span>
      )}
      <HeadingTag
        className={`font-sans font-bold uppercase tracking-spec leading-tight text-[#111111] ${titleSizes}`}
      >
        {title}
      </HeadingTag>
      {description && (
        <p className="mt-2 text-xs sm:text-sm text-[#767676] max-w-xl font-sans normal-case tracking-normal">
          {description}
        </p>
      )}
    </div>
  );
};
