import { formatDistanceToNow, format } from 'date-fns'

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(date) {
  if (!date) return 'N/A'
  return format(new Date(date), 'MMM d, yyyy HH:mm')
}

export function formatRelativeTime(date) {
  if (!date) return 'N/A'
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function getSLAStatusColor(status) {
  const colors = {
    healthy: 'text-cortex-success bg-cortex-success/10',
    warning: 'text-cortex-warning bg-cortex-warning/10',
    at_risk: 'text-orange-500 bg-orange-500/10',
    critical: 'text-cortex-danger bg-cortex-danger/10',
    breached: 'text-cortex-critical bg-cortex-critical/10',
    paused: 'text-blue-500 bg-blue-500/10',
    resolved: 'text-gray-500 bg-gray-500/10',
    not_applicable: 'text-cortex-muted bg-cortex-muted/10'
  }
  return colors[status] || colors.healthy
}

export function getPriorityColor(priority) {
  const colors = {
    P1: 'text-cortex-critical bg-cortex-critical/10',
    P2: 'text-cortex-danger bg-cortex-danger/10',
    P3: 'text-cortex-warning bg-cortex-warning/10',
    P4: 'text-blue-500 bg-blue-500/10',
    P5: 'text-cortex-muted bg-cortex-muted/10'
  }
  return colors[priority] || colors.P3
}

export function getEscalationLevelColor(level) {
  if (level === 0) return 'text-cortex-muted bg-cortex-muted/10'
  if (level === 1) return 'text-cortex-warning bg-cortex-warning/10'
  if (level === 2) return 'text-orange-500 bg-orange-500/10'
  if (level === 3) return 'text-cortex-danger bg-cortex-danger/10'
  return 'text-cortex-critical bg-cortex-critical/10'
}

export function getStatusColor(status) {
  const statusLower = status?.toLowerCase() || ''
  if (statusLower.includes('closed') || statusLower.includes('resolved')) {
    return 'text-gray-500 bg-gray-500/10'
  }
  if (statusLower.includes('progress') || statusLower.includes('active')) {
    return 'text-cortex-accent bg-cortex-accent/10'
  }
  if (statusLower.includes('hold') || statusLower.includes('blocked')) {
    return 'text-cortex-warning bg-cortex-warning/10'
  }
  return 'text-cortex-text bg-cortex-surface'
}

export function getSentimentEmoji(sentiment) {
  const emojis = {
    positive: '😊',
    neutral: '😐',
    negative: '😟',
    frustrated: '😤',
    angry: '😡'
  }
  return emojis[sentiment] || '😐'
}

export function truncate(str, length = 100) {
  if (!str) return ''
  return str.length > length ? str.substring(0, length) + '...' : str
}
