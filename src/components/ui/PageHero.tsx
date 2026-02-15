/**
 * Page Hero
 * Shared top section used across dashboard pages to add visual identity and quick context.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type HeroTone = 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'blue';

interface HeroMetric {
  label: string;
  value: string | number;
}

interface PageHeroProps {
  title: string;
  subtitle: string;
  icon?: React.ElementType;
  tone?: HeroTone;
  metrics?: HeroMetric[];
  action?: React.ReactNode;
  className?: string;
}

const toneStyles: Record<
  HeroTone,
  {
    ring: string;
    icon: string;
    orb: string;
    chip: string;
  }
> = {
  cyan: {
    ring: 'from-cyan-400/35 via-sky-400/20 to-transparent',
    icon: 'from-cyan-400 to-sky-500',
    orb: 'bg-cyan-400/20',
    chip: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  },
  emerald: {
    ring: 'from-emerald-400/30 via-teal-400/20 to-transparent',
    icon: 'from-emerald-400 to-teal-500',
    orb: 'bg-emerald-400/20',
    chip: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  },
  amber: {
    ring: 'from-amber-300/35 via-orange-400/20 to-transparent',
    icon: 'from-amber-300 to-orange-500',
    orb: 'bg-amber-400/20',
    chip: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  },
  violet: {
    ring: 'from-violet-400/35 via-fuchsia-400/20 to-transparent',
    icon: 'from-violet-400 to-fuchsia-500',
    orb: 'bg-violet-400/20',
    chip: 'border-violet-400/30 bg-violet-400/10 text-violet-200',
  },
  rose: {
    ring: 'from-rose-400/35 via-pink-400/20 to-transparent',
    icon: 'from-rose-400 to-pink-500',
    orb: 'bg-rose-400/20',
    chip: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  },
  blue: {
    ring: 'from-blue-400/35 via-indigo-400/20 to-transparent',
    icon: 'from-blue-400 to-indigo-500',
    orb: 'bg-blue-400/20',
    chip: 'border-blue-400/30 bg-blue-400/10 text-blue-200',
  },
};

export function PageHero({
  title,
  subtitle,
  icon: Icon,
  tone = 'cyan',
  metrics = [],
  action,
  className,
}: PageHeroProps) {
  const style = toneStyles[tone];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-3xl border border-white/10',
        'bg-gradient-to-br from-dark-800/90 via-dark-850/85 to-dark-900/95',
        'p-5 md:p-7',
        className
      )}
    >
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', style.ring)} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3">
        <div className={cn('absolute -top-14 -right-14 h-52 w-52 rounded-full blur-3xl', style.orb)} />
      </div>

      <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          {Icon && (
            <div
              className={cn(
                'mt-0.5 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg',
                style.icon
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white md:text-3xl">{title}</h1>
            <p className="max-w-3xl text-sm text-gray-300 md:text-base">{subtitle}</p>
          </div>
        </div>

        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>

      {metrics.length > 0 && (
        <div className="relative mt-5 flex flex-wrap gap-2.5">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={cn(
                'rounded-xl border px-3 py-2 backdrop-blur-sm',
                'min-w-[120px]',
                style.chip
              )}
            >
              <p className="text-xs uppercase tracking-wide text-gray-300/85">{metric.label}</p>
              <p className="text-base font-semibold text-white">{metric.value}</p>
            </div>
          ))}
        </div>
      )}
    </motion.section>
  );
}

