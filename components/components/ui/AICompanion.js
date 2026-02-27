'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Trash2 } from 'lucide-react';
import { useAuth, apiFetch } from '@/lib/auth';

export default function AICompanion() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Only show for admin/support
  if (!user || (user.role !== 'admin' && user.role !== 'support')) {
    return null;
  }

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

  const loadHistory = async () => {
    try {
      const data = await apiFetch('/api/companion/history');
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages.map(m => ({
          ...m,
          timestamp: Date.now()
        })));
      }
      setInitialized(true);
    } catch (error) {
      console.error('Failed to load history:', error);
      setInitialized(true);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const data = await apiFetch('/api/companion/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMessage.content })
      });

      const assistantMessage = {
        role: 'assistant',
        content: data.reply,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear conversation history?')) return;

    try {
      await apiFetch('/api/companion/clear', { method: 'POST' });
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear:', error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none hidden md:block">
      <div className="pointer-events-auto">
        {!isOpen ? (
          // Closed state - floating button
          <button
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 bg-cortex-accent hover:bg-cortex-accent/90 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
          >
            <Bot className="w-6 h-6 text-white" />
          </button>
        ) : (
          // Open state - chat panel
          <div className="w-96 h-[500px] bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-cortex-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-cortex-accent/20 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-cortex-accent" />
                </div>
                <div>
                  <div className="font-semibold text-cortex-text">Cortex AI</div>
                  <div className="text-xs text-cortex-muted">Support Operations</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClear}
                  className="p-2 hover:bg-cortex-bg rounded-lg transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4 text-cortex-muted" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-cortex-bg rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-cortex-muted" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-cortex-muted text-sm text-center px-8">
                    Ask me about tickets, SLAs, or escalations
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={msg.role === 'user' ? 'ml-8' : 'mr-8'}
                    >
                      <div
                        className={`
                          px-4 py-2 text-sm rounded-2xl
                          ${msg.role === 'user'
                            ? 'bg-cortex-accent/20 text-cortex-text rounded-br-sm'
                            : 'bg-cortex-bg text-cortex-text rounded-bl-sm'
                          }
                        `}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="mr-8">
                      <div className="bg-cortex-bg rounded-2xl rounded-bl-sm px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-cortex-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-cortex-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-cortex-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-cortex-border">
              <div className="flex gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question..."
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