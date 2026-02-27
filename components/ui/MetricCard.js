'use client'

import { cn } from '@/lib/utils'

export default function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  variant = 'info',
  loading = false 
}) {
  return (
    <div className={cn('metric-card', variant)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-cortex-muted mb-1">{title}</p>
          {loading ? (
            <div className="h-10 w-24 bg-cortex-border animate-pulse rounded"></div>
          ) : (
            <p className="text-4xl font-display font-bold mb-2">{value}</p>
          )}
          {subtitle && (
            <p className="text-xs text-cortex-muted">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              'text-xs font-mono mt-2',
              trend.direction === 'up' ? 'text-cortex-danger' : 'text-cortex-success'
            )}>
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            'p-3 rounded-lg',
            variant === 'critical' && 'bg-cortex-critical/10',
            variant === 'warning' && 'bg-cortex-warning/10',
            variant === 'success' && 'bg-cortex-success/10',
            variant === 'info' && 'bg-cortex-accent/10'
          )}>
            <Icon className={cn(
              'w-6 h-6',
              variant === 'critical' && 'text-cortex-critical',
              variant === 'warning' && 'text-cortex-warning',
              variant === 'success' && 'text-cortex-success',
              variant === 'info' && 'text-cortex-accent'
            )} />
          </div>
        )}
      </div>
    </div>
  )
}
