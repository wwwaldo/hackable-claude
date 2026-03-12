import { useState, useRef, useEffect } from 'react'
import { Fact } from '../factcache'
import type { Theme } from '../theme'

interface Message {
  id:      string
  role:    'user' | 'assistant'
  content: string
  tokens?: number
  thinking?: string
}

interface ChatPaneProps {
  onClearSession:           () => void
  onClearMessages:          () => void
  messages:                 Message[]
  streaming:                boolean
  streamText:               string
  streamThinking:           string
  extendedReasoning:        boolean
  onToggleExtendedReasoning: () => void
  onSend:                   (text: string) => void
  onDeleteMsg:              (id: string) => void
  onEditMsg:                (id: string, content: string) => void
  apiKey:                   string
  onApiKeySet:              (key: string) => void
  model:                    string
  theme:                    Theme
  onToggleTheme:            () => void
}

export function ChatPane({
  messages, streaming, streamText, streamThinking, extendedReasoning, onToggleExtendedReasoning,
  onSend, onDeleteMsg, onEditMsg, onClearSession, onClearMessages,
  apiKey, onApiKeySet, model, theme, onToggleTheme,
}: ChatPaneProps) {
  const [input,      setInput]      = useState('')
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editDraft,  setEditDraft]  = useState('')
  const [apiDraft,   setApiDraft]   = useState(apiKey)
  const [showApiKey, setShowApiKey] = useState(!apiKey)
  const [showThinking, setShowThinking] = useState<{[key: string]: boolean}>({})
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText, streamThinking])

  function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    onSend(text)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function startEdit(msg: Message) {
    setEditingId(msg.id)
    setEditDraft(msg.content)
  }

  function saveEdit() {
    if (editingId) { onEditMsg(editingId, editDraft); setEditingId(null) }
  }

  function toggleThinking(msgId: string) {
    setShowThinking(prev => ({ ...prev, [msgId]: !prev[msgId] }))
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minWidth: 0,
    }}>
      {/* Header — WebkitAppRegion makes the whole bar draggable in Electron */}
      <div style={{
        padding: '10px 20px',
        paddingLeft: 80,   /* leave room for macOS traffic lights */
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: 'var(--surface)',
        WebkitAppRegion: 'drag',  /* entire header is draggable */
      } as React.CSSProperties}>
        <div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: '-0.03em',
            color: 'var(--accent)',
          }}>Hackable Claude</span>
          <span style={{
            marginLeft: 10,
            fontSize: 10,
            color: 'var(--text2)',
            letterSpacing: '0.08em',
          }}>{model}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={onToggleTheme}
            className="theme-toggle"
            style={{
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <button
            onClick={onToggleExtendedReasoning}
            style={{
              fontSize: 10,
              color: extendedReasoning ? 'var(--accent)' : 'var(--text2)',
              border: `1px solid ${extendedReasoning ? 'var(--accent)' : 'var(--border2)'}`,
              borderRadius: 3,
              padding: '3px 10px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>🧠</span>
            <span>{extendedReasoning ? 'Extended' : 'Standard'}</span>
          </button>
          <button
            onClick={onClearMessages}
            disabled={messages.length === 0}
            style={{
              fontSize: 10,
              color: messages.length === 0 ? 'var(--border2)' : 'var(--text2)',
              border: '1px solid var(--border2)',
              borderRadius: 3,
              padding: '3px 10px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >clear msgs</button>
          <button
            onClick={onClearSession}
            style={{
              fontSize: 10,
              color: 'var(--text2)',
              border: '1px solid var(--border2)',
              borderRadius: 3,
              padding: '3px 10px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >reset</button>
          <button
            onClick={() => setShowApiKey(v => !v)}
            style={{
              fontSize: 10,
              color: apiKey ? 'var(--accent)' : 'var(--danger)',
              border: `1px solid ${apiKey ? 'var(--accent)' : 'var(--danger)'}`,
              borderRadius: 3,
              padding: '3px 10px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {apiKey ? '● API Key Set' : '⚠ Set API Key'}
          </button>
        </div>
      </div>

      {/* API key input */}
      {showApiKey && (
        <div style={{
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}>
          <input
            type="password"
            value={apiDraft}
            onChange={e => setApiDraft(e.target.value)}
            placeholder="sk-ant-api03-..."
            style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
            onKeyDown={e => e.key === 'Enter' && (onApiKeySet(apiDraft), setShowApiKey(false))}
          />
          <button
            onClick={() => { onApiKeySet(apiDraft); setShowApiKey(false) }}
            style={{
              padding: '6px 16px',
              background: 'var(--accent)',
              color: 'var(--bg)',
              borderRadius: 3,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              fontSize: 12,
            }}
          >Save</button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {messages.length === 0 && !streaming && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text2)',
            gap: 12,
          }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              fontWeight: 800,
              color: 'var(--border2)',
              letterSpacing: '-0.04em',
            }}>
              hackable.
            </div>
            <div style={{ fontSize: 11, textAlign: 'center', maxWidth: 280, lineHeight: 1.8 }}>
              Every message is a block. Every block is editable.<br />
              Watch the context window update in real time →
            </div>
            {extendedReasoning && (
              <div style={{ 
                fontSize: 10, 
                color: 'var(--accent)', 
                textAlign: 'center',
                padding: '6px 12px',
                background: 'var(--surface2)',
                borderRadius: 4,
                border: '1px solid var(--accent)33',
              }}>
                🧠 Extended reasoning enabled
              </div>
            )}
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className="fade-in"
            style={{
              marginBottom: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              fontSize: 9,
              color: 'var(--text2)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 4,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}>
              <span style={{ color: msg.role === 'user' ? 'var(--accent4)' : 'var(--accent)' }}>
                {msg.role}
              </span>
              {msg.tokens && <span>{msg.tokens.toLocaleString()} tok</span>}
              {msg.thinking && (
                <button
                  onClick={() => toggleThinking(msg.id)}
                  style={{
                    fontSize: 8,
                    color: '#9333ea',
                    border: '1px solid #9333ea33',
                    borderRadius: 2,
                    padding: '1px 4px',
                    background: showThinking[msg.id] ? '#9333ea22' : 'transparent',
                  }}
                >
                  🧠 {showThinking[msg.id] ? 'hide' : 'show'} thinking
                </button>
              )}
            </div>

            {/* Show thinking if toggled on */}
            {msg.thinking && showThinking[msg.id] && (
              <div style={{
                maxWidth: 580,
                padding: '8px 12px',
                borderRadius: 4,
                background: '#9333ea11',
                border: '1px solid #9333ea33',
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginBottom: 6,
                color: 'var(--text2)',
              }}>
                <div style={{
                  fontSize: 9,
                  color: '#9333ea',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}>
                  🧠 Claude's Reasoning
                </div>
                {msg.thinking}
              </div>
            )}

            {editingId === msg.id ? (
              <div style={{ width: '100%', maxWidth: 580 }}>
                <textarea
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  style={{ width: '100%', minHeight: 80, padding: 8, fontSize: 13 }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button onClick={saveEdit} style={{
                    padding: '4px 12px', background: 'var(--accent)',
                    color: 'var(--bg)', borderRadius: 3, fontSize: 11,
                    fontWeight: 700, fontFamily: 'var(--font-display)',
                  }}>Save</button>
                  <button onClick={() => setEditingId(null)} style={{
                    padding: '4px 12px', border: '1px solid var(--border2)',
                    borderRadius: 3, fontSize: 11, color: 'var(--text2)',
                  }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  maxWidth: 580,
                  padding: '10px 14px',
                  borderRadius: 6,
                  background: msg.role === 'user' ? 'var(--surface2)' : 'var(--surface)',
                  border: `1px solid ${msg.role === 'user' ? 'var(--border2)' : 'var(--border)'}`,
                  borderLeft: msg.role === 'assistant' ? '3px solid var(--accent)' : undefined,
                  fontSize: 13,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  position: 'relative',
                  cursor: 'default',
                }}
              >
                {msg.content}

                {/* Hover actions */}
                <div style={{
                  position: 'absolute',
                  top: 6,
                  right: 8,
                  display: 'flex',
                  gap: 4,
                  opacity: 0,
                }}
                  className="msg-actions"
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <button
                    onClick={() => startEdit(msg)}
                    title="Edit"
                    style={{ fontSize: 10, color: 'var(--text2)', padding: '1px 5px', border: '1px solid var(--border2)', borderRadius: 2 }}
                  >✎</button>
                  <button
                    onClick={() => onDeleteMsg(msg.id)}
                    title="Delete"
                    style={{ fontSize: 10, color: 'var(--danger)', padding: '1px 5px', border: '1px solid var(--danger)33', borderRadius: 2 }}
                  >✕</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Streaming assistant response */}
        {streaming && (
          <div className="fade-in" style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 9, color: 'var(--accent)', letterSpacing: '0.1em',
              textTransform: 'uppercase', marginBottom: 4,
            }}>assistant</div>
            
            {/* Show thinking stream if extended reasoning is on */}
            {extendedReasoning && streamThinking && (
              <div style={{
                maxWidth: 580,
                padding: '8px 12px',
                borderRadius: 4,
                background: '#9333ea11',
                border: '1px solid #9333ea33',
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginBottom: 8,
                color: 'var(--text2)',
              }}>
                <div style={{
                  fontSize: 9,
                  color: '#9333ea',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}>
                  🧠 Claude's Reasoning
                </div>
                {streamThinking}
                <span style={{ display: 'inline-block', width: 6, height: 12, background: '#9333ea', marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s step-end infinite', borderRadius: 1 }} />
              </div>
            )}

            <div style={{
              maxWidth: 580,
              padding: '10px 14px',
              borderRadius: 6,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--accent)',
              fontSize: 13,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {streamText || <span style={{ animation: 'pulse 1s infinite', display: 'inline-block', width: 8, height: 13, background: 'var(--accent)', verticalAlign: 'middle', borderRadius: 1 }} />}
              {streamText && <span style={{ display: 'inline-block', width: 6, height: 12, background: 'var(--accent)', marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s step-end infinite', borderRadius: 1 }} />}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--surface)',
      }}>
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          border: '1px solid var(--border2)',
          borderRadius: 6,
          padding: '8px 12px',
          background: 'var(--surface2)',
          transition: 'border-color 0.2s',
        }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--accent3)')}
          onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Claude… (Enter to send, Shift+Enter for newline)"
            disabled={streaming || !apiKey}
            rows={1}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              fontSize: 13,
              lineHeight: 1.6,
              resize: 'none',
              maxHeight: 160,
              overflowY: 'auto',
              outline: 'none',
              color: 'var(--text)',
            }}
            onInput={e => {
              const t = e.currentTarget
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 160) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !apiKey || !input.trim()}
            style={{
              padding: '6px 14px',
              background: (streaming || !apiKey || !input.trim()) ? 'var(--border2)' : 'var(--accent)',
              color: (streaming || !apiKey || !input.trim()) ? 'var(--text2)' : 'var(--bg)',
              borderRadius: 4,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              fontSize: 12,
              flexShrink: 0,
              cursor: (streaming || !apiKey || !input.trim()) ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {streaming ? '…' : 'Send'}
          </button>
        </div>
        <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 6, letterSpacing: '0.06em', textAlign: 'right' }}>
          {!apiKey && <span style={{ color: 'var(--danger)' }}>Set API key to chat · </span>}
          {input.length > 0 && <span>~{Math.ceil(input.length / 4)} tok · </span>}
          {extendedReasoning && <span style={{ color: '#9333ea' }}>🧠 extended reasoning · </span>}
          shift+enter for newline
        </div>
      </div>

      <style>{`
        .msg-actions { opacity: 0; transition: opacity 0.15s; }
        div:hover > .msg-actions { opacity: 1 !important; }
      `}</style>
    </div>
  )
}