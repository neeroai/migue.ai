import type { ReactNode } from 'react';

interface CTAProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'medium' | 'large';
  onClick?: () => void;
}

export function CTA({
  children,
  variant = 'primary',
  size = 'medium',
  onClick
}: CTAProps): React.JSX.Element {
  const baseStyles = 'inline-flex items-center gap-2 font-semibold rounded-lg transition-all hover:scale-105 active:scale-95';

  const variantStyles = {
    primary: 'bg-gradient-primary text-white hover:shadow-lg hover:shadow-primary-500/50',
    secondary: 'bg-white text-primary-600 hover:shadow-lg hover:shadow-black/20',
  };

  const sizeStyles = {
    medium: 'px-6 py-3 text-base',
    large: 'px-8 py-4 text-lg',
  };

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </button>
  );
}