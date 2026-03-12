import { useState, useRef, useEffect } from 'react'
import { Fact } from '../factcache'

interface BlockCardProps {
  fact: Fact
  onUpdate: (id: string, content: string) => void
  onDelete: (id: string) => void
}

export function BlockCard({ fact, onUpdate, onDelete }: BlockCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [draft,    setDraft]    = useState(fact.content)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textRef.current) {
      textRef.current.focus()
      textRef.current.style.height = 'auto'
      textRef.current.style.height = textRef.current.scrollHeight + 'px'
    }
  }, [editing])

  function save() {
    onUpdate(fact.id, draft)
    setEditing(false)
  }

  function cancel() {
    setDraft(fact.content)
    setEditing(false)
  }

  const preview = fact.content.slice(0, 120) + (fact.content.length > 120 ? '…' : '')

  return (
    <div style={{
      border: `1px solid ${expanded ? fact.color + '55' : 'var(--border)'}`,
      borderLeft: `3px solid ${fact.color}`,
      borderRadius: 4,
      background: expanded ? 'var(--surface2)' : 'var(--surface)',
      transition: 'border-color 0.2s, background 0.2s',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => !editing && setExpanded(e => !e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 10px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Expand caret */}
        <span style={{
          fontSize: 8,
          color: 'var(--text2)',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s',
          flexShrink: 0,
        }}>▶</span>

        {/* Label */}
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 12,
          color: fact.color,
          flexShrink: 0,
        }}>
          {fact.label}
        </span>

        {/* Preview text */}
        {!expanded && (
          <span style={{
            color: 'var(--text2)',
            fontSize: 11,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {preview}
          </span>
        )}

        {/* Token count */}
        <span style={{
          fontSize: 10,
          color: 'var(--text2)',
          flexShrink: 0,
          marginLeft: 'auto',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {fact.tokens.toLocaleString()} tok
        </span>

        {/* Mini bar */}
        <div style={{
          width: 40, height: 3,
          background: 'var(--border2)',
          borderRadius: 2,
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min((fact.tokens / 8000) * 100, 100)}%`,
            background: fact.color,
            borderRadius: 2,
          }} />
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 10px 10px', animation: 'fadeIn 0.15s ease' }}>
          {editing ? (
            <>
              <textarea
                ref={textRef}
                value={draft}
                onChange={e => {
                  setDraft(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: '8px',
                  fontSize: 12,
                  lineHeight: 1.6,
                  border: '1px solid var(--accent3)',
                  borderRadius: 3,
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={save} style={{
                  padding: '4px 12px',
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  borderRadius: 3,
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                }}>Save</button>
                <button onClick={cancel} style={{
                  padding: '4px 12px',
                  border: '1px solid var(--border2)',
                  borderRadius: 3,
                  fontSize: 11,
                  color: 'var(--text2)',
                }}>Cancel</button>
                <span style={{ fontSize: 10, color: 'var(--text2)', alignSelf: 'center', marginLeft: 4 }}>
                  ~{Math.ceil(draft.length / 4).toLocaleString()} tok
                </span>
              </div>
            </>
          ) : (
            <>
              <pre style={{
                fontSize: 11,
                lineHeight: 1.7,
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 200,
                overflowY: 'auto',
                padding: '6px 0',
              }}>
                {fact.content}
              </pre>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    padding: '3px 10px',
                    border: '1px solid var(--border2)',
                    borderRadius: 3,
                    fontSize: 10,
                    color: 'var(--text2)',
                  }}
                >Edit</button>
                {!fact.pinned && (
                  <button
                    onClick={() => onDelete(fact.id)}
                    style={{
                      padding: '3px 10px',
                      border: '1px solid var(--danger)',
                      borderRadius: 3,
                      fontSize: 10,
                      color: 'var(--danger)',
                    }}
                  >Delete</button>
                )}
                {fact.pinned && (
                  <span style={{ fontSize: 10, color: 'var(--text2)', alignSelf: 'center' }}>📌 pinned</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
