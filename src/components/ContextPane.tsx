import { useState, useEffect } from 'react'
import { Fact, FactCache } from '../factcache'
import { MemoryBank } from '../memorybank'
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
  memoryBank?: MemoryBank
  memoryStats?: any
  onAddMemory?: (label: string, content: string, category: 'conversation' | 'insight' | 'code' | 'reference' | 'other') => Promise<string>
}

export function ContextPane({ 
  cache, 
  apiTokens, 
  onUpdate, 
  onDelete, 
  onInject, 
  onSystemChange,
  memoryBank,
  memoryStats,
  onAddMemory
}: ContextPaneProps) {
  const [showInject,  setShowInject]  = useState(false)
  const [showSystem,  setShowSystem]  = useState(false)
  const [showMemory,  setShowMemory]  = useState(false)
  const [sysContent,  setSysContent]  = useState(cache.get('system_prompt')?.content ?? '')
  const [memoryLabel, setMemoryLabel] = useState('')
  const [memoryContent, setMemoryContent] = useState('')
  const [memoryCategory, setMemoryCategory] = useState<'conversation' | 'insight' | 'code' | 'reference' | 'other'>('conversation')

  const facts = cache.all()
  const byCategory = cache.byCategory()

  const categoryOrder = [
    'System Prompt', 
    'Tool Definitions', 
    'Memory Bank',        // Add Memory Bank to display order
    'File Summary', 
    'Injected Context', 
    'User Message', 
    'Assistant Message', 
    'Tool Activity'
  ]
  const orderedCats = categoryOrder.filter(c => byCategory[c]?.length)

  useEffect(() => {
    if (showSystem) setSysContent(cache.get('system_prompt')?.content ?? '')
  }, [showSystem])

  // Generate conversation summary when memory modal opens
  useEffect(() => {
    if (showMemory && !memoryLabel && !memoryContent) {
      const summary = generateConversationSummary(cache)
      setMemoryLabel(summary.label)
      setMemoryContent(summary.content)
    }
  }, [showMemory, cache, memoryLabel, memoryContent])

  function saveSystem() {
    onSystemChange(sysContent)
    setShowSystem(false)
  }

  async function saveMemory() {
    if (!onAddMemory || !memoryLabel.trim() || !memoryContent.trim()) return
    
    try {
      await onAddMemory(memoryLabel.trim(), memoryContent.trim(), memoryCategory)
      setMemoryLabel('')
      setMemoryContent('')
      setShowMemory(false)
    } catch (error) {
      console.error('Failed to save memory entry:', error)
    }
  }

  // Custom update/delete handlers for memory entries
  function handleMemoryUpdate(id: string, content: string) {
    const entry = memoryBank?.getEntry(id)
    if (entry?.isReadonly) {
      alert('This memory entry is read-only and cannot be edited.')
      return
    }
    onUpdate(id, content)
  }

  function handleMemoryDelete(id: string) {
    const entry = memoryBank?.getEntry(id)
    if (entry?.isReadonly) {
      alert('This memory entry is read-only and cannot be deleted.')
      return
    }
    onDelete(id)
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
          >System</button>
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
          >Inject</button>
          {memoryBank && onAddMemory && (
            <button
              onClick={() => setShowMemory(true)}
              style={{
                flex: 1,
                padding: '5px 0',
                border: '1px solid #8b5cf6',
                borderRadius: 3,
                fontSize: 10,
                color: '#8b5cf6',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
              }}
            >🧠 Memory</button>
          )}
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
                {(byCategory[cat] ?? []).map(fact => {
                  // Use special handlers for memory entries
                  const isMemoryEntry = cat === 'Memory Bank'
                  return (
                    <BlockCard
                      key={fact.id}
                      fact={fact}
                      onUpdate={isMemoryEntry ? handleMemoryUpdate : onUpdate}
                      onDelete={isMemoryEntry ? handleMemoryDelete : onDelete}
                    />
                  )
                })}
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
                Context Summary
              </div>
              <div>Facts: <span style={{ color: 'var(--accent)' }}>{facts.length}</span></div>
              <div>Estimated: <span style={{ color: 'var(--accent)' }}>{cache.totalTokens.toLocaleString()}</span> tok</div>
              {apiTokens && <div>API counted: <span style={{ color: 'var(--accent)' }}>{apiTokens.toLocaleString()}</span> tok</div>}
              <div>Remaining: <span style={{ color: 'var(--accent)' }}>{cache.remainingTokens.toLocaleString()}</span> tok</div>
              <div>Fill: <span style={{ color: cache.usagePct > 80 ? 'var(--danger)' : 'var(--accent)' }}>{cache.usagePct.toFixed(2)}%</span></div>
            </div>
          )}

          {/* Enhanced Memory Bank stats */}
          {memoryBank && memoryStats && (
            <div style={{
              marginTop: 8,
              padding: '10px',
              border: '1px solid #8b5cf6',
              borderRadius: 4,
              fontSize: 10,
              color: 'var(--text2)',
              lineHeight: 1.8,
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: '#8b5cf6', marginBottom: 4, fontSize: 11 }}>
                🧠 Memory Bank
              </div>
              <div>Total: <span style={{ color: '#8b5cf6' }}>{memoryStats.totalEntries}</span> entries</div>
              <div style={{ paddingLeft: 8, fontSize: 9, color: 'var(--text3)' }}>
                Local: {memoryStats.localEntries} • User: {memoryStats.userEntries}
              </div>
              <div>Tokens: <span style={{ color: '#8b5cf6' }}>{memoryStats.totalTokens.toLocaleString()}</span> / 50k</div>
              <div style={{ paddingLeft: 8, fontSize: 9, color: 'var(--text3)' }}>
                Local: {memoryStats.localTokens.toLocaleString()} • User: {memoryStats.userTokens.toLocaleString()}
              </div>
              <div>Usage: <span style={{ color: memoryStats.utilizationPercent > 80 ? 'var(--danger)' : '#8b5cf6' }}>{memoryStats.utilizationPercent}%</span></div>
              {memoryStats.userUtilizationPercent !== memoryStats.utilizationPercent && (
                <div style={{ paddingLeft: 8, fontSize: 9, color: 'var(--text3)' }}>
                  User only: {memoryStats.userUtilizationPercent}%
                </div>
              )}
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

      {/* Memory Bank modal */}
      {showMemory && (
        <div
          onClick={() => setShowMemory(false)}
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
              border: '1px solid #8b5cf6',
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
              color: '#8b5cf6',
              marginBottom: 4,
              letterSpacing: '-0.02em',
            }}>
              🧠 Add to Memory Bank
            </div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 16 }}>
              Persistent context that survives across conversations · 50k token limit · Auto-generated summary below
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                Label
              </label>
              <input
                type="text"
                value={memoryLabel}
                onChange={e => setMemoryLabel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: 12,
                  border: '1px solid var(--border2)',
                  borderRadius: 4,
                }}
                placeholder="Brief descriptive label..."
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                Category
              </label>
              <select
                value={memoryCategory}
                onChange={e => setMemoryCategory(e.target.value as any)}
                style={{
                  padding: '8px',
                  fontSize: 12,
                  border: '1px solid var(--border2)',
                  borderRadius: 4,
                }}
              >
                <option value="conversation">Conversation</option>
                <option value="insight">Insight</option>
                <option value="code">Code</option>
                <option value="reference">Reference</option>
                <option value="other">Other</option>
              </select>
            </div>

            <textarea
              value={memoryContent}
              onChange={e => setMemoryContent(e.target.value)}
              style={{
                width: '100%',
                minHeight: 200,
                padding: '10px',
                fontSize: 12,
                lineHeight: 1.7,
                marginBottom: 8,
              }}
              placeholder="Content to remember across conversations..."
            />
            
            <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 14 }}>
              ~{Math.ceil(memoryContent.length / 4).toLocaleString()} tokens
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowMemory(false)} style={{
                padding: '7px 18px', border: '1px solid var(--border2)',
                borderRadius: 4, fontSize: 12, color: 'var(--text2)',
              }}>Cancel</button>
              <button 
                onClick={saveMemory} 
                disabled={!memoryLabel.trim() || !memoryContent.trim()}
                style={{
                  padding: '7px 18px', 
                  background: (!memoryLabel.trim() || !memoryContent.trim()) ? 'var(--border2)' : '#8b5cf6',
                  borderRadius: 4, fontSize: 12, fontWeight: 700,
                  fontFamily: 'var(--font-display)', color: 'white',
                  opacity: (!memoryLabel.trim() || !memoryContent.trim()) ? 0.5 : 1,
                  cursor: (!memoryLabel.trim() || !memoryContent.trim()) ? 'not-allowed' : 'pointer',
                }}
              >Save to Memory</button>
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

// Generate a conversation summary for auto-filling the memory modal
function generateConversationSummary(cache: FactCache): { label: string; content: string } {
  const userMessages = cache.all().filter(f => f.type === 'user')
  const assistantMessages = cache.all().filter(f => f.type === 'assistant')
  
  if (userMessages.length === 0 && assistantMessages.length === 0) {
    return {
      label: 'Empty Conversation',
      content: 'No conversation to summarize yet.'
    }
  }

  // Build conversation context for Claude to summarize
  const conversationText = [
    '# Conversation to Summarize',
    '',
    ...userMessages.flatMap((userMsg, i) => {
      const assistantMsg = assistantMessages[i]
      const parts = [`**User**: ${userMsg.content}`]
      if (assistantMsg) {
        parts.push(`**Assistant**: ${assistantMsg.content}`)
      }
      return parts
    })
  ].join('\n')

  // Create a summarization prompt
  const summaryPrompt = `Please summarize the conversation above into 500 tokens or less. If the conversation doesn't seem important, use 50 tokens or less. Important topics do not include coding and do include personal life and career advice.

Focus on:
- Key insights or decisions
- Personal context or preferences shared
- Important questions or problems discussed
- Actionable outcomes or next steps

Format the summary as clear, concise bullet points or paragraphs.`

  // Generate a descriptive label based on conversation content
  const firstUserMessage = userMessages[0]?.content || 'conversation'
  const topicWords = firstUserMessage
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'they', 'have', 'will', 'been', 'were', 'said', 'what', 'when', 'where', 'would', 'could', 'should'].includes(w))
    .slice(0, 3)
  
  const label = topicWords.length > 0 
    ? `Conversation: ${topicWords.join(' ')}`
    : `Conversation ${new Date().toLocaleDateString()}`

  return {
    label,
    content: `${conversationText}\n\n---\n\n${summaryPrompt}`
  }
}