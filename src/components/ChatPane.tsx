import { useState, useRef, useEffect } from 'react'
import { Fact } from '../factcache'
import { MemoryBank, MemoryEntry } from '../memorybank'
import { ConceptDisplay } from './ConceptDisplay'
import { AutopilotDemo } from './AutopilotDemo'
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
  memoryBank?:              MemoryBank
  onAddMemory?:             (label: string, content: string, category?: 'conversation' | 'insight' | 'code' | 'reference' | 'other') => Promise<string>
  onSearchMemory?:          (query: string) => MemoryEntry[]
  recentConcepts?:          string[]
  autopilot?:               { active: boolean; queue: { prompt: string; progressNote: string }[]; stepsRemaining: number; totalSteps: number; objective: string }
  onStartAutopilot?:        (objective: string, steps: number) => void
  onStopAutopilot?:         () => void
}

export function ChatPane({
  messages, streaming, streamText, streamThinking, extendedReasoning, onToggleExtendedReasoning,
  onSend, onDeleteMsg, onEditMsg, onClearSession, onClearMessages,
  apiKey, onApiKeySet, model, theme, onToggleTheme,
  memoryBank, onAddMemory, onSearchMemory, recentConcepts = [],
  autopilot, onStartAutopilot, onStopAutopilot,
}: ChatPaneProps) {
  const [input,      setInput]      = useState('')
  const [showAutopilot, setShowAutopilot] = useState(false)
  const [apObjective, setApObjective] = useState('')
  const [apSteps, setApSteps] = useState(5)
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

  // Autofocus the input when component mounts or when API key is available
  useEffect(() => {
    if (apiKey && inputRef.current) {
      inputRef.current.focus()
    }
  }, [apiKey])

  // Initial focus on component mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [])

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

  // Quick memory actions for messages
  async function saveToMemory(msg: Message, category: 'conversation' | 'insight' | 'code' | 'reference' | 'other' = 'conversation') {
    if (!onAddMemory) return
    const label = `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.slice(0, 50)}${msg.content.length > 50 ? '...' : ''}`
    await onAddMemory(label, msg.content, category)
  }

  function handleStartAutopilot() {
    if (!onStartAutopilot || !apObjective.trim()) return
    onStartAutopilot(apObjective.trim(), apSteps)
    setShowAutopilot(false)
    setApObjective('')
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minWidth: 0,
    }}>
      {recentConcepts.length > 0 && <ConceptDisplay concepts={recentConcepts} />}
      
      {/* Autopilot Concept Evolution Demo */}
      {(autopilot?.active || recentConcepts.length > 0) && (
        <div style={{ 
          position: 'absolute', 
          top: recentConcepts.length > 0 ? 130 : 60, 
          left: 20, 
          right: 20,
          zIndex: 100 
        }}>
          <AutopilotDemo 
            isActive={autopilot?.active || false}
            currentStep={autopilot?.stepsRemaining || 0}
            totalSteps={autopilot?.totalSteps || 5}
            concepts={recentConcepts}
          />
        </div>
      )}

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
          {memoryBank && (
            <span style={{
              marginLeft: 8,
              fontSize: 9,
              color: '#8b5cf6',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: '#8b5cf611',
              padding: '1px 4px',
              borderRadius: 2,
              border: '1px solid #8b5cf633',
            }}>
              🧠 Memory Active
            </span>
          )}
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
          {onStartAutopilot && (
            <button
              onClick={() => autopilot?.active ? onStopAutopilot?.() : setShowAutopilot(true)}
              style={{
                fontSize: 10,
                color: autopilot?.active ? 'var(--danger)' : 'var(--accent2)',
                border: `1px solid ${autopilot?.active ? 'var(--danger)' : 'var(--accent2)'}`,
                borderRadius: 3,
                padding: '3px 10px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{autopilot?.active ? '⏹' : '🤖'}</span>
              <span>{autopilot?.active ? 'Stop' : 'Autopilot'}</span>
            </button>
          )}
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
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '20px',
        paddingTop: recentConcepts.length > 0 ? 50 : 20,
      }}>
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
            {memoryBank && (
              <div style={{ 
                fontSize: 10, 
                color: '#8b5cf6', 
                textAlign: 'center',
                padding: '6px 12px',
                background: '#8b5cf611',
                borderRadius: 4,
                border: '1px solid #8b5cf633',
              }}>
                🧠 Memory Bank active
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
                  {memoryBank && onAddMemory && (
                    <button
                      onClick={() => saveToMemory(msg)}
                      title="Save to Memory"
                      style={{ 
                        fontSize: 10, 
                        color: '#8b5cf6', 
                        padding: '1px 5px', 
                        border: '1px solid #8b5cf633', 
                        borderRadius: 2,
                        background: '#8b5cf611',
                      }}
                    >🧠</button>
                  )}
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
          {memoryBank && <span style={{ color: '#8b5cf6' }}>🧠 memory active · </span>}
          shift+enter for newline
        </div>
      </div>

      {/* Autopilot active status bar */}
      {autopilot?.active && (
        <div style={{
          padding: '6px 20px',
          background: 'var(--accent2)11',
          borderTop: '1px solid var(--accent2)33',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent2)',
            animation: 'pulse 1.5s infinite',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 10, color: 'var(--accent2)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Autopilot Active
          </span>
          <span style={{ fontSize: 10, color: 'var(--text2)' }}>
            {autopilot.stepsRemaining}/{autopilot.totalSteps} steps remaining
          </span>
          {autopilot.queue.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text2)', fontStyle: 'italic', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              next: {autopilot.queue[0]?.progressNote}
            </span>
          )}
          <button
            onClick={onStopAutopilot}
            style={{
              marginLeft: 'auto', fontSize: 10, color: 'var(--danger)',
              border: '1px solid var(--danger)33', borderRadius: 3,
              padding: '2px 8px',
            }}
          >Stop</button>
        </div>
      )}

      {/* Autopilot start modal */}
      {showAutopilot && (
        <div
          onClick={() => setShowAutopilot(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--accent2)',
              borderRadius: 8, padding: 24,
              width: '90%', maxWidth: 480,
              boxShadow: '0 0 60px rgba(0,0,0,0.8)',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
              color: 'var(--accent2)', marginBottom: 4, letterSpacing: '-0.02em',
            }}>
              🤖 Autopilot
            </div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 16 }}>
              Give Claude an objective and a step budget. It will autonomously work through the task, using tools and queuing its own follow-up prompts.
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                Objective
              </label>
              <textarea
                value={apObjective}
                onChange={e => setApObjective(e.target.value)}
                placeholder="e.g. Refactor the theme system to support custom color palettes"
                style={{ width: '100%', minHeight: 80, padding: 8, fontSize: 12, lineHeight: 1.6 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                Max Steps: {apSteps}
              </label>
              <input
                type="range" min={1} max={20} value={apSteps}
                onChange={e => setApSteps(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text2)' }}>
                <span>1</span><span>10</span><span>20</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAutopilot(false)} style={{
                padding: '7px 18px', border: '1px solid var(--border2)',
                borderRadius: 4, fontSize: 12, color: 'var(--text2)',
              }}>Cancel</button>
              <button
                onClick={handleStartAutopilot}
                disabled={!apObjective.trim()}
                style={{
                  padding: '7px 18px',
                  background: apObjective.trim() ? 'var(--accent2)' : 'var(--border2)',
                  borderRadius: 4, fontSize: 12, fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: apObjective.trim() ? 'white' : 'var(--text2)',
                  cursor: apObjective.trim() ? 'pointer' : 'not-allowed',
                }}
              >Launch →</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .msg-actions { opacity: 0; transition: opacity 0.15s; }
        div:hover > .msg-actions { opacity: 1 !important; }
      `}</style>
    </div>
  )
}