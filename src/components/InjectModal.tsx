import { useState } from 'react'

interface InjectModalProps {
  onInject: (label: string, content: string) => void
  onClose:  () => void
}

export function InjectModal({ onInject, onClose }: InjectModalProps) {
  const [label,   setLabel]   = useState('Context Block')
  const [content, setContent] = useState('')

  function handleInject() {
    if (!content.trim()) return
    onInject(label.trim() || 'Context Block', content.trim())
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          borderRadius: 8,
          padding: 24,
          width: '90%',
          maxWidth: 560,
          boxShadow: '0 0 60px rgba(0,0,0,0.8)',
          animation: 'fadeIn 0.15s ease',
        }}
      >
        <div style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 18,
          color: 'var(--accent2)',
          marginBottom: 16,
          letterSpacing: '-0.02em',
        }}>
          Inject Context Block
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
            Label
          </label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', fontSize: 13 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
            Content &nbsp;
            <span style={{ color: 'var(--accent)', fontSize: 10 }}>
              ~{Math.ceil(content.length / 4).toLocaleString()} tokens
            </span>
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Paste a document, code, memory dump, custom instructions…"
            style={{
              width: '100%',
              minHeight: 200,
              padding: '8px 10px',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 18px',
              border: '1px solid var(--border2)',
              borderRadius: 4,
              fontSize: 12,
              color: 'var(--text2)',
            }}
          >Cancel</button>
          <button
            onClick={handleInject}
            disabled={!content.trim()}
            style={{
              padding: '7px 18px',
              background: content.trim() ? 'var(--accent2)' : 'var(--border2)',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: content.trim() ? 'var(--bg)' : 'var(--text2)',
              cursor: content.trim() ? 'pointer' : 'not-allowed',
            }}
          >Inject →</button>
        </div>
      </div>
    </div>
  )
}
