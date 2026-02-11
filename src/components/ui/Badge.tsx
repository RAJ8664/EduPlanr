/**
 * Badge Component
 * Small status indicators and labels
 */

import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'neon' | 'purple' | 'green' | 'yellow' | 'red' | 'outline' | 'blue' | 'orange';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-dark-700 text-gray-300 border-dark-600',
  neon: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30',
  purple: 'bg-neon-purple/10 text-neon-purple border-neon-purple/30',
  green: 'bg-neon-green/10 text-neon-green border-neon-green/30',
  yellow: 'bg-neon-yellow/10 text-neon-yellow border-neon-yellow/30',
  red: 'bg-red-500/10 text-red-400 border-red-500/30',
  outline: 'bg-transparent text-gray-300 border-dark-500',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'neon' && 'bg-neon-cyan',
            variant === 'purple' && 'bg-neon-purple',
            variant === 'green' && 'bg-neon-green',
            variant === 'yellow' && 'bg-neon-yellow',
            variant === 'red' && 'bg-red-400',
            variant === 'default' && 'bg-gray-400',
            variant === 'outline' && 'bg-gray-400',
            variant === 'blue' && 'bg-blue-400',
            variant === 'orange' && 'bg-orange-400'
          )}
        />
      )}
      {children}
    </span>
  );
}

/**
 * Priority Badge Component
 */
interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'critical';
  className?: string;
}

const priorityConfig = {
  low: { label: 'Low', variant: 'default' as BadgeVariant },
  medium: { label: 'Medium', variant: 'neon' as BadgeVariant },
  high: { label: 'High', variant: 'yellow' as BadgeVariant },
  critical: { label: 'Critical', variant: 'red' as BadgeVariant },
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];

  return (
    <Badge variant={config.variant} size="sm" dot className={className}>
      {config.label}
    </Badge>
  );
}

/**
 * Status Badge Component
 */
interface StatusBadgeProps {
  status: 'not-started' | 'in-progress' | 'completed' | 'cancelled' | 'pending' | 'skipped';
  className?: string;
}

const statusConfig = {
  'not-started': { label: 'Not Started', variant: 'default' as BadgeVariant },
  pending: { label: 'Pending', variant: 'default' as BadgeVariant },
  'in-progress': { label: 'In Progress', variant: 'neon' as BadgeVariant },
  completed: { label: 'Completed', variant: 'green' as BadgeVariant },
  cancelled: { label: 'Cancelled', variant: 'red' as BadgeVariant },
  skipped: { label: 'Skipped', variant: 'yellow' as BadgeVariant },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} size="sm" dot className={className}>
      {config.label}
    </Badge>
  );
}
