'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, ExternalLink, RefreshCw, Key, Trash2, AlertCircle, ListTodo } from 'lucide-react'
import toast from 'react-hot-toast'
import NewBadge from '@/components/ui/NewBadge'

const PRIORITY_COLORS = {
  urgent: 'bg-red-500/15 text-red-400',
  high:   'bg-cortex-warning/15 text-cortex-warning',
  normal: 'bg-cortex-accent/15 text-cortex-accent',
  low:    'bg-cortex-muted/15 text-cortex-muted',
}

function getPriorityColor(p) {
  return PRIORITY_COLORS[p?.toLowerCase()] || 'bg-cortex-muted/15 text-cortex-muted'
}

async function fetchTasks() {
  const res = await fetch('/api/tasks')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (data.error === 'no_token') return { noToken: true }
    if (data.error === 'invalid_token') return { invalidToken: true }
    throw new Error(data.error || 'Failed to fetch tasks')
  }
  return res.json()
}

async function saveToken(token) {
  const res = await fetch('/api/users/me/clickup-token', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to save token')
  return data
}

async function removeToken() {
  const res = await fetch('/api/users/me/clickup-token', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to remove token')
}

async function markComplete(taskId) {
  const tokenRes = await fetch('/api/users/me/clickup-token')
  if (!tokenRes.ok) throw new Error('No token')
  // We don't expose the token to the client — mark complete via a dedicated route
  const res = await fetch(`/api/tasks/${taskId}/complete`, { method: 'POST' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to mark complete')
  }
}

export default function AgentTasksPage() {
  const queryClient = useQueryClient()
  const [tokenInput, setTokenInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['agent-tasks'],
    queryFn: fetchTasks,
    refetchInterval: 60000,
    retry: false,
  })

  const handleSaveToken = async (e) => {
    e.preventDefault()
    if (!tokenInput.trim()) return
    setSaving(true)
    try {
      const result = await saveToken(tokenInput.trim())
      toast.success(`Connected as ${result.clickup_username || result.clickup_email}`)
      setTokenInput('')
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveToken = async () => {
    try {
      await removeToken()
      toast.success('ClickUp token removed')
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleMarkComplete = async (taskId) => {
    setCompleting(taskId)
    try {
      await markComplete(taskId)
      toast.success('Task marked complete')
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCompleting(null)
    }
  }

  const showTokenSetup = data?.noToken || data?.invalidToken

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">My Work</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text flex items-center gap-2">My ClickUp Tasks <NewBadge description="New page — connect your ClickUp account to view and manage your assigned tasks. Mark tasks complete directly from Cortex." /></h1>
        </div>
        {!showTokenSetup && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={handleRemoveToken}
              className="flex items-center gap-1.5 text-xs text-cortex-muted hover:text-cortex-danger transition-colors"
              title="Disconnect ClickUp"
            >
              <Trash2 className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Token setup */}
      {showTokenSetup && (
        <div className="card max-w-lg">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-cortex-accent/10 flex items-center justify-center flex-shrink-0">
              <Key className="w-5 h-5 text-cortex-accent" />
            </div>
            <div>
              <h2 className="font-semibold text-cortex-text mb-1">Connect your ClickUp account</h2>
              {data?.invalidToken ? (
                <p className="text-sm text-cortex-danger">Your saved token is no longer valid. Please enter a new one.</p>
              ) : (
                <p className="text-sm text-cortex-muted">
                  Paste your ClickUp personal API token to see tasks assigned to you.
                  Get it from <span className="text-cortex-accent font-medium">ClickUp → Settings → Apps → API Token</span>.
                </p>
              )}
            </div>
          </div>
          <form onSubmit={handleSaveToken} className="space-y-3">
            <input
              type="password"
              placeholder="pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              className="input w-full font-mono text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={saving || !tokenInput.trim()}
              className="btn-primary w-full disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Verifying…</> : 'Connect ClickUp'}
            </button>
          </form>
        </div>
      )}

      {/* Loading */}
      {isLoading && !showTokenSetup && (
        <div className="card">
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-cortex-bg animate-pulse rounded-xl" />)}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card flex items-center gap-3 text-cortex-danger bg-cortex-danger/5 border-cortex-danger/20">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {/* Task list */}
      {data?.tasks && (
        <>
          {data.tasks.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-20 text-cortex-muted">
              <div className="w-14 h-14 rounded-2xl bg-cortex-surface-raised flex items-center justify-center mb-4">
                <ListTodo className="w-7 h-7 opacity-40" />
              </div>
              <p className="font-medium text-cortex-text mb-1">No open tasks</p>
              <p className="text-sm">Tasks assigned to you in ClickUp will appear here</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-cortex-border bg-cortex-bg flex items-center justify-between">
                <span className="text-sm font-semibold text-cortex-text">
                  {data.tasks.length} open task{data.tasks.length !== 1 ? 's' : ''}
                </span>
                {data.clickup_user && (
                  <span className="text-xs text-cortex-muted font-mono">
                    {data.clickup_user.username || data.clickup_user.email}
                  </span>
                )}
              </div>
              <div className="divide-y divide-cortex-border">
                {data.tasks.map(task => (
                  <div key={task.id} className="px-5 py-4 flex items-start gap-4 hover:bg-cortex-surface-raised transition-colors group">
                    <button
                      onClick={() => handleMarkComplete(task.id)}
                      disabled={completing === task.id}
                      title="Mark complete"
                      className="mt-0.5 flex-shrink-0 text-cortex-muted hover:text-cortex-success transition-colors disabled:opacity-40"
                    >
                      {completing === task.id
                        ? <RefreshCw className="w-5 h-5 animate-spin" />
                        : <CheckSquare className="w-5 h-5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {task.priority && (
                          <span className={`badge text-[10px] ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        )}
                        <span className="badge bg-cortex-surface-raised text-cortex-muted text-[10px] capitalize">
                          {task.status}
                        </span>
                        {task.due_date && (
                          <span className={`text-[10px] font-mono ${new Date(task.due_date) < new Date() ? 'text-cortex-danger' : 'text-cortex-muted'}`}>
                            Due {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-cortex-text">{task.name}</p>
                      {task.description && (
                        <p className="text-xs text-cortex-muted mt-1 line-clamp-2">{task.description}</p>
                      )}
                    </div>
                    {task.url && (
                      <a
                        href={task.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-cortex-muted hover:text-cortex-accent transition-colors opacity-0 group-hover:opacity-100 mt-0.5"
                        title="Open in ClickUp"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
