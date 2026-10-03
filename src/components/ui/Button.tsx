import React, { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text';
  size?: 'sm' | 'md' | 'lg';
  fillOnHover?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  fillOnHover = false,
  isLoading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}, ref) => {
  // Base typography and geometry tokens conforming to REFERENCE-SPEC
  const baseStyles = 'inline-flex items-center justify-center font-sans uppercase font-bold tracking-spec rounded-none transition-all duration-default select-none focus-visible:outline-2 focus-visible:outline-[#111111] focus-visible:outline-offset-2 disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'text-[11px] h-8 px-4 gap-1.5',
    md: 'text-[12px] sm:text-[13px] h-10 sm:h-11 px-6 gap-2',
    lg: 'text-[13px] sm:text-[14px] h-12 sm:h-14 px-8 sm:px-10 gap-2.5',
  }[size];

  const variantStyles = {
    primary: fillOnHover
      ? 'bg-[#111111] text-white border border-transparent btn-fill-hover hover:border-black'
      : 'bg-[#111111] text-white border border-transparent hover:bg-black active:scale-[0.99]',
    secondary: fillOnHover
      ? 'bg-white text-[#2D2D2D] border border-[#DDDDDD] btn-fill-hover [--btn-hover-fill:#2D2D2D] hover:text-white'
      : 'bg-white text-[#2D2D2D] border border-[#DDDDDD] hover:bg-[#111111] hover:text-white hover:border-[#111111] active:scale-[0.99]',
    text: 'bg-transparent text-[#2D2D2D] border-b border-transparent hover:border-[#111111] px-0 h-auto font-medium hover:text-black',
  }[variant];

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${widthStyle} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="animate-spin h-3.5 w-3.5 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="opacity-90">{children}</span>
        </span>
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';
