import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'success' | 'info' | 'web3' | 'warning' | 'danger' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  showDot?: boolean;
  className?: string;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
  success: {
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
  },
  info: {
    badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    dot: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]',
  },
  web3: {
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    dot: 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]',
  },
  warning: {
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
  },
  danger: {
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    dot: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]',
  },
  neutral: {
    badge: 'bg-gray-800/60 text-gray-300 border-gray-700/60',
    dot: 'bg-gray-400',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  showDot = false,
  className,
  children,
  ...props
}) => {
  const styles = variantStyles[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border backdrop-blur-md transition-colors',
        styles.badge,
        className
      )}
      {...props}
    >
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 animate-pulse', styles.dot)} />
      )}
      {children}
    </span>
  );
};
