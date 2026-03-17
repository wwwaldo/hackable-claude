import { useState } from 'react'
import { ToolCall, ToolResult } from '../api'

export interface ToolEvent {
  id:       string
  type:     'call' | 'result'
  call?:    ToolCall
  result?:  ToolResult
  ts:       number
}

interface ToolPaneProps {
  events:      ToolEvent[]
  serverOnline: boolean
  toolsEnabled: boolean
  onToggleTools: () => void
}

const TOOL_ICONS: Record<string, string> = {
  list_files:   '📁',
  read_file:    '📖',
  write_file:   '✏️',
  patch_file:   '🩹',
  list_backups: '🗂️',
  web_search:   '🔍',
  web_fetch:    '🌐',
}

const TOOL_COLORS: Record<string, string> = {
  list_files:   '#00d4ff',
  read_file:    '#7c6aff',
  write_file:   '#ff6b35',
  patch_file:   '#ffcc00',
  list_backups: '#00ff9d',
  web_search:   '#f59e0b',
  web_fetch:    '#06b6d4',
}

export function ToolPane({ events, serverOnline, toolsEnabled, onToggleTools }: ToolPaneProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Pair calls with results
  const pairs: { call: ToolCall; result?: ToolResult }[] = []
  const resultMap = new Map<string, ToolResult>()
  for (const ev of events) {
    if (ev.type === 'result' && ev.result) resultMap.set(ev.result.id, ev.result)
  }
  for (const ev of events) {
    if (ev.type === 'call' && ev.call) {
      pairs.push({ call: ev.call, result: resultMap.get(ev.call.id) })
    }
  }

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      flexShrink: 0,
      background: 'var(--surface)',
      maxHeight: toolsEnabled ? 220 : 40,
      transition: 'max-height 0.3s ease',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
        borderBottom: toolsEnabled ? '1px solid var(--border)' : 'none',
        flexShrink: 0,
        cursor: 'pointer',
      }} onClick={onToggleTools}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: serverOnline ? 'var(--accent)' : 'var(--danger)',
          boxShadow: serverOnline ? '0 0 6px var(--accent)' : 'none',
          flexShrink: 0,
          animation: serverOnline ? 'pulse 2s infinite' : 'none',
        }} />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: serverOnline ? 'var(--accent)' : 'var(--text2)',
        }}>
          {serverOnline ? 'File API Online' : 'File API Offline'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text2)' }}>
          · port 3001 · {pairs.length} tool calls this session
        </span>
        <div style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text2)' }}>
            {toolsEnabled ? 'tools on' : 'tools off'}
          </span>
          <div style={{
            width: 32, height: 18, borderRadius: 9,
            background: toolsEnabled ? 'var(--accent)' : 'var(--border2)',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: 2, left: toolsEnabled ? 16 : 2,
              width: 14, height: 14, borderRadius: '50%',
              background: 'white', transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ fontSize: 10, color: 'var(--text2)' }}>
            {toolsEnabled ? '▾' : '▸'}
          </span>
        </div>
      </div>

      {/* Tool call log */}
      {toolsEnabled && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px' }}>
          {pairs.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text2)', padding: '10px 4px' }}>
              {serverOnline
                ? 'Ask Claude to list, read, or modify its own source files. e.g. "minify yourself to fit in context" or "add a dark/light mode toggle"'
                : 'Start the file server: run  npm run dev  (not  npm run dev:app)'}
            </div>
          )}
          {pairs.map(({ call, result }) => {
            const color    = TOOL_COLORS[call.name] ?? '#888'
            const icon     = TOOL_ICONS[call.name] ?? '🔧'
            const expanded = expandedIds.has(call.id)
            const hasResult = !!result

            return (
              <div
                key={call.id}
                style={{
                  marginBottom: 4,
                  border: `1px solid ${color}33`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 3,
                  overflow: 'hidden',
                  fontSize: 11,
                }}
              >
                {/* Call header */}
                <div
                  onClick={() => toggleExpand(call.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 8px', cursor: 'pointer',
                    background: expanded ? `${color}11` : 'transparent',
                  }}
                >
                  <span>{icon}</span>
                  <span style={{ color, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                    {call.name}
                  </span>
                  {call.input.path ? (
                    <span style={{ color: 'var(--text2)' }}>{String(call.input.path)}</span>
                  ) : null}
                  {call.input.reason ? (
                    <span style={{ color: 'var(--text2)', fontStyle: 'italic', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      — {String(call.input.reason)}
                    </span>
                  ) : null}
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: hasResult ? 'var(--accent)' : 'var(--accent2)' }}>
                    {hasResult ? '✓ done' : '⟳ running'}
                  </span>
                </div>

                {/* Expanded result */}
                {expanded && result && (
                  <div style={{
                    padding: '6px 8px',
                    borderTop: `1px solid ${color}22`,
                    background: 'var(--bg)',
                    maxHeight: 120,
                    overflowY: 'auto',
                  }}>
                    <pre style={{
                      fontSize: 10, color: 'var(--text2)',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      lineHeight: 1.5,
                    }}>
                      {result.output.length > 1200
                        ? result.output.slice(0, 1200) + '\n…(truncated)'
                        : result.output}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
