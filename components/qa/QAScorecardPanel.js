'use client'

/* NEW: QA Scorecard Panel — right-side slide panel with 12-category accordion, gauge, coaching */

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createQAReview, getQAReviews } from '@/lib/api'
import { X, ChevronDown, ChevronRight, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate, getPriorityColor } from '@/lib/utils'

// ─── QA Schema ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'greeting',              label: 'Greeting',              weight: 5,  description: 'Appropriate opening, professional tone, company name used.' },
  { key: 'verification',          label: 'Verification',          weight: 10, description: 'Caller/customer identity confirmed per policy before sharing case data.' },
  { key: 'problem_understanding', label: 'Problem Understanding',  weight: 10, description: 'Root cause understood, active listening demonstrated, no assumptions made.' },
  { key: 'empathy',               label: 'Empathy',               weight: 10, description: 'Customer frustration acknowledged, empathy statements used appropriately.' },
  { key: 'accuracy',              label: 'Accuracy',              weight: 15, description: 'Information provided was correct, no misleading statements made.' },
  { key: 'process_compliance',    label: 'Process Compliance',    weight: 10, description: 'Correct procedure followed — escalation, hold, transfer per SOP.' },
  { key: 'resolution_quality',    label: 'Resolution Quality',    weight: 15, description: 'Issue fully resolved or correctly escalated; follow-up confirmed if needed.' },
  { key: 'communication_clarity', label: 'Communication Clarity', weight: 5,  description: 'Clear, jargon-free language. Customer confirmed understanding.' },
  { key: 'ownership',             label: 'Ownership',             weight: 5,  description: 'Agent took full responsibility, did not deflect to other teams.' },
  { key: 'closing',               label: 'Closing',               weight: 5,  description: 'Proper sign-off, case status updated, reference number provided.' },
  { key: 'documentation',         label: 'Documentation',         weight: 5,  description: 'Case notes accurate, complete, and entered during/after interaction.' },
  { key: 'crm_hygiene',           label: 'CRM Hygiene',           weight: 5,  description: 'CRM fields correctly filled: module, request type, case type, resolution.' },
]

const CRITICAL_FLAGS = [
  { key: 'misleading_info',         label: 'Provided incorrect/misleading information' },
  { key: 'privacy_violation',       label: 'Violated data privacy/security policy' },
  { key: 'inappropriate_language',  label: 'Used inappropriate language or tone' },
  { key: 'failed_escalation',       label: 'Failed to follow escalation procedure' },
  { key: 'no_verification',         label: 'Did not verify caller/customer identity' },
  { key: 'abandoned_interaction',   label: 'Terminated interaction without resolution' },
  { key: 'falsified_records',       label: 'Falsified records or case information' },
  { key: 'compliance_breach',       label: 'Failed to follow critical compliance process' },
]

const IMPROVEMENT_THEMES = [
  { key: 'active_listening',      label: 'Active Listening' },
  { key: 'product_knowledge',     label: 'Product Knowledge' },
  { key: 'empathy',               label: 'Empathy' },
  { key: 'process_adherence',     label: 'Process Adherence' },
  { key: 'documentation',         label: 'Documentation' },
  { key: 'escalation_handling',   label: 'Escalation Handling' },
  { key: 'communication_clarity', label: 'Communication Clarity' },
]

// ─── Score helpers ───────────────────────────────────────────────────────────

function calcTotal(scores, critFlags) {
  let total = CATEGORIES.reduce((sum, cat) => {
    const s = scores[cat.key]
    if (s == null) return sum
    return sum + (s / 5) * cat.weight
  }, 0)
  const hasCrit = Object.values(critFlags || {}).some(Boolean)
  if (hasCrit) total = Math.max(0, total - 25)
  return Math.round(total)
}

function calcResult(score, critFlags) {
  const hasCrit = Object.values(critFlags || {}).some(Boolean)
  if (hasCrit) return 'critical_fail'
  if (score >= 85) return 'pass'
  if (score >= 70) return 'borderline'
  if (score >= 50) return 'coaching_required'
  return 'fail'
}

function resultLabel(result) {
  const MAP = { pass: 'Pass', borderline: 'Borderline', coaching_required: 'Coaching Req.', fail: 'Fail', critical_fail: 'Critical Fail' }
  return MAP[result] || result
}
function resultColor(result) {
  if (result === 'pass')             return 'text-cortex-success bg-cortex-success/15'
  if (result === 'borderline')       return 'text-cortex-warning bg-cortex-warning/15'
  if (result === 'coaching_required')return 'text-blue-400 bg-blue-400/15'
  if (result === 'fail')             return 'text-cortex-danger bg-cortex-danger/15'
  if (result === 'critical_fail')    return 'text-cortex-danger bg-cortex-danger/20 font-bold'
  return 'text-cortex-muted bg-cortex-muted/10'
}
function gaugeColor(score) {
  if (score >= 85) return '#22c55e'
  if (score >= 70) return '#f59e0b'
  return '#ef4444'
}

// ─── SVG Gauge ───────────────────────────────────────────────────────────────

function ScoreGauge({ score, result }) {
  const R = 54
  const circ = 2 * Math.PI * R
  const pct = Math.min(Math.max(score, 0), 100) / 100
  const dash = pct * circ
  const color = gaugeColor(score)

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* Track */}
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgb(var(--cortex-border))" strokeWidth="10" />
        {/* Arc */}
        <circle
          cx="70" cy="70" r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
        {/* Score text */}
        <text x="70" y="68" textAnchor="middle" dominantBaseline="middle" fontSize="26" fontWeight="bold" fill={color} fontFamily="'IBM Plex Sans', sans-serif">
          {score}
        </text>
        <text x="70" y="90" textAnchor="middle" fontSize="11" fill="rgb(var(--cortex-muted))" fontFamily="'IBM Plex Sans', sans-serif">
          / 100
        </text>
      </svg>
      <span className={`badge text-xs ${resultColor(result)}`}>{resultLabel(result)}</span>
    </div>
  )
}

// ─── Score Buttons ────────────────────────────────────────────────────────────

function ScoreButtons({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-7 h-7 rounded-md text-xs font-bold transition-all border ${
            value === n
              ? n >= 4
                ? 'bg-cortex-success text-white border-cortex-success'
                : n >= 2
                  ? 'bg-cortex-warning text-white border-cortex-warning'
                  : 'bg-cortex-danger text-white border-cortex-danger'
              : 'border-cortex-border text-cortex-muted hover:border-cortex-accent hover:text-cortex-accent bg-cortex-bg'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

// ─── Category Row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, score, comment, onChange, onCommentChange }) {
  const [open, setOpen] = useState(false)
  const weighted = score != null ? ((score / 5) * cat.weight).toFixed(1) : '—'

  return (
    <div className="border border-cortex-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-cortex-bg transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-cortex-muted flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-cortex-muted flex-shrink-0" />}
          <span className="text-sm font-medium text-cortex-text truncate">{cat.label}</span>
          <span className="text-[10px] text-cortex-muted">({cat.weight}%)</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-mono text-cortex-muted">{weighted} pts</span>
          <ScoreButtons value={score} onChange={onChange} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 bg-cortex-bg space-y-2">
          <p className="text-xs text-cortex-muted leading-relaxed">{cat.description}</p>
          <textarea
            rows={2}
            placeholder="Add a comment for this category (optional)…"
            value={comment || ''}
            onChange={e => onCommentChange(e.target.value)}
            className="input w-full text-xs resize-none"
          />
        </div>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function QAScorecardPanel({ row, onClose }) {
  /* NEW: QA Scorecard Panel */
  const queryClient = useQueryClient()
  const isNew = !row || row.qa_result === 'pending'

  // Derive ticket info from row
  const ticketId  = row?.ticket_id
  const agentId   = row?.agent_id || row?._raw?.agent_id || null
  const agentName = row?.agent_name || '—'
  const title     = row?.title || '—'
  const priority  = row?.priority || ''
  const channel   = row?._raw?.ticket_channel || row?._raw?.channel || '—'
  const module    = row?.module || '—'
  const customer  = row?.customer || '—'
  const clickupId = row?.clickup_id || `#${ticketId}`
  const slaPct    = row?.sla_pct

  // Existing review data (for view mode)
  const existingReview = isNew ? null : row?._raw

  // ── Form state ────────────────────────────────────────────────────────────
  const [scores,   setScores]   = useState(() => {
    if (existingReview?.scores && typeof existingReview.scores === 'object') return existingReview.scores
    return {}
  })
  const [comments, setComments] = useState({})
  const [critFlags, setCritFlags] = useState(() => {
    if (existingReview?.critical_flags && typeof existingReview.critical_flags === 'object') return existingReview.critical_flags
    return {}
  })
  const [coachingNotes,  setCoachingNotes]  = useState(existingReview?.coaching_notes || '')
  const [followUpAction, setFollowUpAction] = useState(existingReview?.follow_up_action || '')
  const [followUpDate,   setFollowUpDate]   = useState(existingReview?.follow_up_date?.split('T')[0] || '')
  const [improvThemes,   setImprovThemes]   = useState(() => {
    if (Array.isArray(existingReview?.improvement_themes)) return existingReview.improvement_themes
    return []
  })
  const [saving, setSaving] = useState(false)

  // ── Derived scores ────────────────────────────────────────────────────────
  const totalScore = useMemo(() => calcTotal(scores, critFlags), [scores, critFlags])
  const result     = useMemo(() => calcResult(totalScore, critFlags), [totalScore, critFlags])

  // ── Review history for this agent ─────────────────────────────────────────
  const { data: agentHistory = [] } = useQuery({
    queryKey: ['qa-agent-history', agentId],
    queryFn: () => agentId ? getQAReviews({ agent_id: agentId, limit: 3 }) : Promise.resolve([]),
    enabled: !!agentId,
  })

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Save (insert new or update existing) ──────────────────────────────────
  const handleSave = async () => {
    if (!ticketId || !agentId) {
      toast.error('Ticket ID and agent are required')
      return
    }
    const hasScores = CATEGORIES.some(c => scores[c.key] != null)
    if (!hasScores) {
      toast.error('Please score at least one category')
      return
    }

    setSaving(true)
    try {
      await createQAReview({
        review_id:         row?.review_id || null,
        ticket_id:         ticketId,
        agent_id:          agentId,
        scores,
        critical_flags:    critFlags,
        coaching_notes:    coachingNotes || null,
        follow_up_action:  followUpAction || null,
        follow_up_date:    followUpDate || null,
        improvement_themes: improvThemes,
        total_score:       totalScore,
        result,
      })
      toast.success(isNew ? 'Scorecard saved' : 'Scorecard updated')
      queryClient.invalidateQueries({ queryKey: ['qa-reviews-queue'] })
      queryClient.invalidateQueries({ queryKey: ['qa-reviews-strip'] })
      queryClient.invalidateQueries({ queryKey: ['qa-agent-perf'] })
      queryClient.invalidateQueries({ queryKey: ['qa-agent-history', agentId] })
      onClose?.()
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    /* NEW: QA Scorecard Panel */
    <div data-new="true" className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel — slides in from right */}
      <div
        className="absolute right-0 top-0 bottom-0 bg-cortex-bg border-l border-cortex-border flex flex-col"
        style={{ width: 'min(1100px, 94vw)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-cortex-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-sm text-cortex-muted">{clickupId}</span>
            {priority && (
              <span className={`badge ${getPriorityColor(priority)}`}>{priority}</span>
            )}
            <span className="text-sm font-semibold text-cortex-text truncate">{agentName}</span>
            {channel !== '—' && (
              <span className="badge bg-cortex-muted/10 text-cortex-muted capitalize">{channel}</span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cortex-surface transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-cortex-muted" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left column — form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Case info grid */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-cortex-muted mb-3">Case Information</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Ticket ID',    value: clickupId },
                  { label: 'Agent',        value: agentName },
                  { label: 'Customer',     value: customer },
                  { label: 'Channel',      value: channel },
                  { label: 'Priority',     value: priority || '—' },
                  { label: 'Module',       value: module },
                  { label: 'SLA %',        value: slaPct != null ? `${Math.round(slaPct)}%` : '—' },
                  { label: 'Review Type',  value: isNew ? 'New Review' : 'Existing Review' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-cortex-surface rounded-xl px-4 py-3 border border-cortex-border">
                    <p className="text-[10px] text-cortex-muted uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-cortex-text truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* QA Scorecard accordion */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-cortex-muted mb-3">QA Scorecard</h3>
              <div className="space-y-2">
                {CATEGORIES.map(cat => (
                  <CategoryRow
                    key={cat.key}
                    cat={cat}
                    score={scores[cat.key] ?? null}
                    comment={comments[cat.key]}
                    onChange={v => setScores(prev => ({ ...prev, [cat.key]: v }))}
                    onCommentChange={v => setComments(prev => ({ ...prev, [cat.key]: v }))}
                  />
                ))}
              </div>
            </div>

            {/* Critical Failures */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-cortex-muted mb-1">Critical Failures</h3>
              <p className="text-xs text-cortex-muted mb-3">Any checked item immediately results in <strong className="text-cortex-danger">Critical Fail</strong> (−25 pts)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CRITICAL_FLAGS.map(flag => (
                  <label
                    key={flag.key}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      critFlags[flag.key]
                        ? 'border-cortex-danger/50 bg-cortex-danger/5'
                        : 'border-cortex-border hover:border-cortex-danger/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!critFlags[flag.key]}
                      onChange={e => setCritFlags(prev => ({ ...prev, [flag.key]: e.target.checked }))}
                      className="mt-0.5 accent-[#ef4444] flex-shrink-0"
                    />
                    <span className="text-xs text-cortex-text leading-relaxed">{flag.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Calibration & Coaching */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-cortex-muted mb-3">Calibration & Coaching</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-cortex-muted mb-1.5">Coaching Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Coaching notes for the agent…"
                    value={coachingNotes}
                    onChange={e => setCoachingNotes(e.target.value)}
                    className="input w-full text-sm resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-cortex-muted mb-1.5">Follow-Up Action</label>
                    <input
                      type="text"
                      placeholder="e.g. Re-training scheduled"
                      value={followUpAction}
                      onChange={e => setFollowUpAction(e.target.value)}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-cortex-muted mb-1.5">Follow-Up Date</label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)}
                      className="input w-full text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cortex-muted mb-2">Improvement Themes</label>
                  <div className="flex flex-wrap gap-2">
                    {IMPROVEMENT_THEMES.map(theme => (
                      <button
                        key={theme.key}
                        type="button"
                        onClick={() => setImprovThemes(prev =>
                          prev.includes(theme.key)
                            ? prev.filter(t => t !== theme.key)
                            : [...prev, theme.key]
                        )}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          improvThemes.includes(theme.key)
                            ? 'bg-cortex-accent text-white border-cortex-accent'
                            : 'border-cortex-border text-cortex-muted hover:border-cortex-accent hover:text-cortex-accent'
                        }`}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="w-72 flex-shrink-0 border-l border-cortex-border overflow-y-auto p-5 space-y-6">

            {/* Score Gauge */}
            <div className="card flex flex-col items-center gap-1">
              <p className="text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-2">Live Score</p>
              <ScoreGauge score={totalScore} result={result} />
            </div>

            {/* Score breakdown */}
            <div className="card space-y-2">
              <p className="text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1">Score Breakdown</p>
              {CATEGORIES.map(cat => {
                const s = scores[cat.key]
                const contrib = s != null ? ((s / 5) * cat.weight).toFixed(1) : null
                return (
                  <div key={cat.key} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-cortex-muted truncate flex-1">{cat.label}</span>
                    <span className={`text-xs font-mono flex-shrink-0 ${
                      s == null ? 'text-cortex-muted' : s >= 4 ? 'text-cortex-success' : s >= 2 ? 'text-cortex-warning' : 'text-cortex-danger'
                    }`}>
                      {contrib !== null ? `${contrib}` : '—'} / {cat.weight}
                    </span>
                  </div>
                )
              })}
              {Object.values(critFlags).some(Boolean) && (
                <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-cortex-border">
                  <span className="text-xs text-cortex-danger">Critical Flag Penalty</span>
                  <span className="text-xs font-mono text-cortex-danger">−25</span>
                </div>
              )}
            </div>

            {/* Review history */}
            {agentHistory.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-cortex-muted uppercase tracking-wider">Recent Reviews</p>
                {agentHistory.slice(0, 3).map(rev => (
                  <div key={rev.id} className="card py-2 px-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-cortex-muted">{rev.clickup_task_id || `#${rev.ticket_id}`}</span>
                      <span className={`badge text-[10px] ${resultColor(rev.result)}`}>{resultLabel(rev.result)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-cortex-muted">{formatDate(rev.reviewed_at)}</span>
                      <span className={`text-sm font-bold font-mono ${
                        rev.total_score >= 85 ? 'text-cortex-success'
                        : rev.total_score >= 70 ? 'text-cortex-warning'
                        : 'text-cortex-danger'
                      }`}>{Math.round(rev.total_score || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom action bar ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-cortex-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={`badge text-sm ${resultColor(result)}`}>{resultLabel(result)}</span>
            <span className="text-xs text-cortex-muted font-mono">Score: {totalScore} / 100</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2 text-sm px-5 py-2"
            >
              {saving ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 40" strokeLinecap="round" />
                </svg>
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving…' : isNew ? 'Save Scorecard' : 'Update Scorecard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
