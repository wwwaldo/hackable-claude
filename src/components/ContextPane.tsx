import { useState } from 'react'
import { Fact, FactCache } from '../factcache'
import { BlockCard } from './BlockCard'
import { TokenBar } from './TokenBar'
import { InjectModal } from './InjectModal'

interface ContextPaneProps {
  cache:       FactCache
  apiTokens?:  number
  onUpdate:    (id: string, content: string) => void
  onDelete:    (id: string) => void
  onInject:    (label: string, content: string) => void
  onSystemChange: (content: string) => void
}

export function ContextPane({ cache, apiTokens, onUpdate, onDelete, onInject, onSystemChange }: ContextPaneProps) {
  const [showInject,  setShowInject]  = useState(false)
  const [showSystem,  setShowSystem]  = useState(false)
  const [sysContent,  setSysContent]  = useState(cache.getSystemPrompt())

  const facts = cache.all()
  const byCategory = cache.byCategory()

  const categoryOrder = ['System Prompt', 'Tool Definitions', 'Injected Context', 'User Message', 'Assistant Message', 'Tool Activity']
  const orderedCats   = categoryOrder.filter(c => byCategory[c]?.length)

  function saveSystem() {
    onSystemChange(sysContent)
    setShowSystem(false)
  }

  return (
    <>
      <div style={{
        width: 360,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}>
        {/* Token bar */}
        <TokenBar cache={cache} apiTokens={apiTokens} />

        {/* Toolbar */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setShowSystem(true)}
            style={{
              flex: 1,
              padding: '5px 0',
              border: '1px solid var(--accent3)',
              borderRadius: 3,
              fontSize: 10,
              color: 'var(--accent3)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
            }}
          >System Prompt</button>
          <button
            onClick={() => setShowInject(true)}
            style={{
              flex: 1,
              padding: '5px 0',
              border: '1px solid var(--accent2)',
              borderRadius: 3,
              fontSize: 10,
              color: 'var(--accent2)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
            }}
          >+ Inject</button>
        </div>

        {/* Block list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
          {orderedCats.length === 0 && (
            <div style={{ color: 'var(--text2)', fontSize: 11, textAlign: 'center', padding: 24 }}>
              No blocks yet.<br />Start a conversation or inject context.
            </div>
          )}

          {orderedCats.map(cat => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 9,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text2)',
                marginBottom: 6,
                paddingLeft: 2,
              }}>
                {cat}
                <span style={{ marginLeft: 6, color: 'var(--border2)', fontSize: 9 }}>
                  {byCategory[cat]?.reduce((s, f) => s + f.tokens, 0).toLocaleString()} tok
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(byCategory[cat] ?? []).map(fact => (
                  <BlockCard
                    key={fact.id}
                    fact={fact}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Summary stats */}
          {facts.length > 0 && (
            <div style={{
              marginTop: 8,
              padding: '10px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              fontSize: 10,
              color: 'var(--text2)',
              lineHeight: 1.8,
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text)', marginBottom: 4, fontSize: 11 }}>
                Cache Summary
              </div>
              <div>Facts: <span style={{ color: 'var(--accent)' }}>{facts.length}</span></div>
              <div>Estimated: <span style={{ color: 'var(--accent)' }}>{cache.totalTokens.toLocaleString()}</span> tok</div>
              {apiTokens && <div>API counted: <span style={{ color: 'var(--accent)' }}>{apiTokens.toLocaleString()}</span> tok</div>}
              <div>Remaining: <span style={{ color: 'var(--accent)' }}>{cache.remainingTokens.toLocaleString()}</span> tok</div>
              <div>Fill: <span style={{ color: cache.usagePct > 80 ? 'var(--danger)' : 'var(--accent)' }}>{cache.usagePct.toFixed(2)}%</span></div>
            </div>
          )}
        </div>
      </div>

      {/* System prompt modal */}
      {showSystem && (
        <div
          onClick={() => setShowSystem(false)}
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
              border: '1px solid var(--border2)',
              borderRadius: 8,
              padding: 24,
              width: '90%',
              maxWidth: 640,
              boxShadow: '0 0 60px rgba(0,0,0,0.8)',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 18,
              color: 'var(--accent3)',
              marginBottom: 4,
              letterSpacing: '-0.02em',
            }}>
              System Prompt
            </div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 16 }}>
              ~{Math.ceil(sysContent.length / 4).toLocaleString()} tokens · prepended to every request
            </div>
            <textarea
              value={sysContent}
              onChange={e => setSysContent(e.target.value)}
              style={{
                width: '100%',
                minHeight: 280,
                padding: '10px',
                fontSize: 12,
                lineHeight: 1.7,
                marginBottom: 14,
              }}
              placeholder="You are a helpful assistant…"
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSystem(false)} style={{
                padding: '7px 18px', border: '1px solid var(--border2)',
                borderRadius: 4, fontSize: 12, color: 'var(--text2)',
              }}>Cancel</button>
              <button onClick={saveSystem} style={{
                padding: '7px 18px', background: 'var(--accent3)',
                borderRadius: 4, fontSize: 12, fontWeight: 700,
                fontFamily: 'var(--font-display)', color: 'white',
              }}>Save →</button>
            </div>
          </div>
        </div>
      )}

      {showInject && (
        <InjectModal
          onInject={onInject}
          onClose={() => setShowInject(false)}
        />
      )}
    </>
  )
}
