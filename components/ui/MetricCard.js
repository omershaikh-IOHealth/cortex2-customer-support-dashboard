'use client'

import { cn } from '@/lib/utils'

const VARIANT_CONFIG = {
  critical: {
    iconBg:   'bg-cortex-critical/10',
    iconText: 'text-cortex-critical',
    valueText: 'text-cortex-critical',
  },
  warning: {
    iconBg:   'bg-cortex-warning/10',
    iconText: 'text-cortex-warning',
    valueText: '',
  },
  success: {
    iconBg:   'bg-cortex-success/10',
    iconText: 'text-cortex-success',
    valueText: '',
  },
  info: {
    iconBg:   'bg-cortex-accent/10',
    iconText: 'text-cortex-accent',
    valueText: '',
  },
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'info',
  loading = false,
}) {
  const cfg = VARIANT_CONFIG[variant] || VARIANT_CONFIG.info

  return (
    <div className={cn('metric-card', variant)}>
      <div className="flex items-start justify-between gap-4">

        {/* Left: text content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-3">
            {title}
          </p>

          {loading ? (
            <div className="h-10 w-28 bg-cortex-border animate-pulse rounded-lg mb-1" />
          ) : (
            <p className={cn(
              'text-4xl font-display font-bold leading-none mb-1',
              cfg.valueText || 'text-cortex-text'
            )}>
              {value}
            </p>
          )}

          {subtitle && (
            <p className="text-xs text-cortex-muted mt-2 leading-relaxed">{subtitle}</p>
          )}

          {trend && (
            <div className={cn(
              'inline-flex items-center gap-1 text-xs font-mono mt-3 px-2 py-0.5 rounded-md',
              trend.direction === 'up'
                ? 'text-cortex-danger bg-cortex-danger/8'
                : 'text-cortex-success bg-cortex-success/8'
            )}>
              <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
              <span>{trend.value}</span>
            </div>
          )}
        </div>

        {/* Right: icon */}
        {Icon && (
          <div className={cn(
            'flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0',
            cfg.iconBg
          )}>
            <Icon className={cn('w-5 h-5', cfg.iconText)} />
          </div>
        )}
      </div>
    </div>
  )
}
