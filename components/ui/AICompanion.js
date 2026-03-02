'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Bot, Send, X, Trash2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { getCriticalSLA, sendCompanionMessage, getCompanionHistory, clearCompanionHistory } from '@/lib/api';

// Global event bus so ticket detail page can open companion with a prefilled message
const listeners = new Set();
export function openCompanionWith(message) {
  listeners.forEach(cb => cb(message));
}

function formatCountdown(dueDate) {
  if (!dueDate) return null;
  const diff = new Date(dueDate) - new Date();
  if (diff <= 0) {
    const over = Math.abs(diff);
    const h = Math.floor(over / 3600000);
    const m = Math.floor((over % 3600000) / 60000);
    return { text: `${h}h ${m}m overdue`, overdue: true };
  }
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return { text: `${h}h ${m}m remaining`, overdue: false };
}

export default function AICompanion() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Drag state
  const [pos, setPos] = useState({ bottom: 24, right: 24 });
  const posInitialized = useRef(false);
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, origRight: 24, origBottom: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const wasDragged = useRef(false);

  const isAgent = user?.role === 'agent';

  // SLA alerts for companion panel
  const { data: slaAlerts = [] } = useQuery({
    queryKey: ['sla-alerts-companion'],
    queryFn: getCriticalSLA,
    refetchInterval: 30000,
    enabled: isOpen,
  });

  // Agents only see their own assigned tickets; admins see all
  const criticalAlerts = slaAlerts.filter(t =>
    t.sla_consumption_pct >= 75 &&
    !['closed', 'resolved', 'complete', 'Closed', 'Resolved'].includes(t.status) &&
    (!isAgent || t.assigned_to_email === user?.email)
  );

  const isVisible = !!(user && (user.role === 'admin' || user.role === 'agent'));

  // Set default position based on role once user is known
  // Agents: sit left of ZIWO widget (ZIWO is 288px wide at right:16 → companion at right:312)
  // Admins: standard bottom-right corner (right:24)
  useEffect(() => {
    if (user && !posInitialized.current) {
      posInitialized.current = true;
      if (user.role === 'agent') {
        setPos({ bottom: 24, right: 312 });
      }
    }
  }, [user]);

  // Global drag listeners
  useEffect(() => {
    function onMove(e) {
      if (!dragState.current.dragging) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragged.current = true;
      const newRight = Math.max(0, dragState.current.origRight - dx);
      const newBottom = Math.max(0, dragState.current.origBottom - dy);
      setPos({ right: newRight, bottom: newBottom });
    }
    function onUp() {
      if (dragState.current.dragging) {
        dragState.current.dragging = false;
        setIsDragging(false);
      }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function startDrag(e) {
    e.preventDefault(); // prevent text selection while dragging
    wasDragged.current = false;
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origRight: pos.right,
      origBottom: pos.bottom,
    };
    setIsDragging(true);
  }

  // loadHistory must be defined before the useEffect that calls it
  const loadHistory = async () => {
    try {
      const data = await getCompanionHistory();
      if (data.messages?.length > 0) {
        setMessages(data.messages.map(m => ({ ...m, timestamp: Date.now() })));
      }
      setInitialized(true);
    } catch {
      setInitialized(true);
    }
  };

  // Register global open handler
  useEffect(() => {
    if (!isVisible) return;
    const handler = (message) => {
      setIsOpen(true);
      if (message) setInput(message);
    };
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, [isVisible]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load history on first open
  useEffect(() => {
    if (isOpen && !initialized) {
      loadHistory();
    }
  }, [isOpen]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // All hooks called — safe to return early now
  if (!isVisible) return null;

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = { role: 'user', content: input.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const data = await sendCompanionMessage(userMessage.content, pathname);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, timestamp: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear conversation history?')) return;
    try {
      await clearCompanionHistory();
      setMessages([]);
    } catch {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const alertBadgeClass = (pct) => {
    if (pct >= 90) return 'text-cortex-critical bg-cortex-critical/10 border border-cortex-critical/20';
    return 'text-cortex-warning bg-cortex-warning/10 border border-cortex-warning/20';
  };

  // Role-aware ticket link: agents link to /my-tickets/*, admins to /tickets/*
  const alertLink = (t) => isAgent ? `/my-tickets/${t.id}` : `/tickets/${t.id}`;

  const placeholderText = isAgent
    ? 'Ask about your tickets or SLA status…'
    : 'Ask about tickets, SLAs, or escalations…';

  return (
    <div
      className="fixed z-50 pointer-events-none hidden md:block"
      style={{ bottom: `${pos.bottom}px`, right: `${pos.right}px` }}
    >
      <div className={`pointer-events-auto${isDragging ? ' select-none' : ''}`}>
        {!isOpen ? (
          <button
            onMouseDown={startDrag}
            onClick={() => { if (!wasDragged.current) setIsOpen(true); }}
            className="relative w-14 h-14 bg-cortex-accent hover:bg-cortex-accent/90 rounded-2xl shadow-accent flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-grab active:cursor-grabbing"
            title="Cortex AI — drag to reposition"
          >
            <Bot className="w-6 h-6 text-white" />
            {criticalAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-cortex-critical text-white text-xs rounded-full flex items-center justify-center font-bold">
                {criticalAlerts.length > 9 ? '9+' : criticalAlerts.length}
              </span>
            )}
          </button>
        ) : (
          <div
            className="w-96 bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: '90vh', minHeight: '400px' }}
          >
            {/* Header — doubles as drag handle */}
            <div
              className="flex items-center justify-between p-4 border-b border-cortex-border shrink-0 cursor-grab active:cursor-grabbing"
              onMouseDown={startDrag}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-cortex-accent/20 rounded-xl flex items-center justify-center">
                  <Bot className="w-5 h-5 text-cortex-accent" />
                </div>
                <div>
                  <div className="font-semibold text-cortex-text">Cortex AI</div>
                  <div className="text-xs text-cortex-muted">
                    {isAgent ? 'Agent Assistant' : 'Support Operations'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClear}
                  onMouseDown={e => e.stopPropagation()}
                  className="p-2 hover:bg-cortex-surface-raised rounded-lg transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4 text-cortex-muted" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  onMouseDown={e => e.stopPropagation()}
                  className="p-2 hover:bg-cortex-surface-raised rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-cortex-muted" />
                </button>
              </div>
            </div>

            {/* SLA Alerts */}
            {criticalAlerts.length > 0 && (
              <div className="border-b border-cortex-border shrink-0">
                <button
                  onClick={() => setAlertsExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-cortex-warning hover:bg-cortex-bg transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {criticalAlerts.length} SLA Alert{criticalAlerts.length !== 1 ? 's' : ''}
                    {isAgent && <span className="font-normal opacity-60 ml-0.5">(your tickets)</span>}
                  </span>
                  {alertsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {alertsExpanded && (
                  <div className="px-3 pb-2 space-y-1 max-h-36 overflow-y-auto">
                    {criticalAlerts.slice(0, 8).map(t => {
                      const cd = formatCountdown(t.sla_resolution_due);
                      return (
                        <a
                          key={t.id}
                          href={alertLink(t)}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 ${alertBadgeClass(t.sla_consumption_pct)}`}
                        >
                          <span className="font-mono truncate mr-2">
                            {t.clickup_task_id || `#${t.id}`} — {t.title?.slice(0, 25)}{t.title?.length > 25 ? '…' : ''}
                          </span>
                          {cd && (
                            <span className={`shrink-0 font-semibold ${cd.overdue ? 'text-cortex-critical' : ''}`}>
                              {cd.overdue ? '⚠ ' : '⏱ '}{cd.text}
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-cortex-muted text-sm text-center px-8">
                    {placeholderText}
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => (
                    <div key={idx} className={msg.role === 'user' ? 'ml-8' : 'mr-8'}>
                      <div className={`px-4 py-2 text-sm rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-cortex-accent/20 text-cortex-text rounded-br-sm'
                          : 'bg-cortex-bg text-cortex-text rounded-bl-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="mr-8">
                      <div className="bg-cortex-bg rounded-2xl rounded-bl-sm px-4 py-3">
                        <div className="flex gap-1">
                          {[0, 150, 300].map(d => (
                            <span key={d} className="w-2 h-2 bg-cortex-muted rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-cortex-border shrink-0">
              <div className="flex gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholderText}
                  disabled={loading}
                  className="flex-1 resize-none bg-cortex-bg border border-cortex-border rounded-xl px-3 py-2 text-sm focus:border-cortex-accent focus:outline-none disabled:opacity-50 max-h-32"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="bg-cortex-accent hover:bg-cortex-accent/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl p-2 transition-colors"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
