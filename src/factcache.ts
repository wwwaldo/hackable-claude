// ============================================================
// FactCache — context window data model
// ============================================================

export type BlockType = 'system' | 'user' | 'assistant' | 'injected' | 'tool-defs' | 'tool-turn' | 'thinking' | 'file-summary' | 'memory'

export type BlockCategory =
  | 'System Prompt'
  | 'Conversation'
  | 'Injected Context'
  | 'User Message'
  | 'Assistant Message'
  | 'Tool Definitions'
  | 'Tool Activity'
  | 'Extended Reasoning'
  | 'File Summary'
  | 'Memory Bank'

export interface FactMeta {
  id: string
  label: string
  content: string
  type: BlockType
  category: BlockCategory
  tokens: number
  pinned?: boolean   // pinned blocks can't be deleted
  color?: string
  createdAt: number
}

// ── Fact ────────────────────────────────────────────────────
export class Fact {
  id: string
  label: string
  content: string
  type: BlockType
  category: BlockCategory
  tokens: number
  pinned: boolean
  color: string
  createdAt: number

  constructor(meta: Omit<FactMeta, 'createdAt'> & { createdAt?: number }) {
    this.id        = meta.id
    this.label     = meta.label
    this.content   = meta.content
    this.type      = meta.type
    this.category  = meta.category
    this.tokens    = meta.tokens
    this.pinned    = meta.pinned ?? false
    this.color     = meta.color ?? CATEGORY_COLORS[meta.category] ?? '#888'
    this.createdAt = meta.createdAt ?? Date.now()
  }

  /** Estimate tokens from content (~4 chars per token) */
  static estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4))
  }

  updateContent(content: string) {
    this.content = content
    this.tokens  = Fact.estimateTokens(content)
  }

  toMessage(): { role: 'user' | 'assistant' | 'system'; content: string } | null {
    if (this.type === 'system' || this.type === 'injected' || this.type === 'thinking' || this.type === 'file-summary' || this.type === 'memory') return null
    return { role: this.type as 'user' | 'assistant', content: this.content }
  }

  toJSON(): FactMeta {
    return {
      id: this.id, label: this.label, content: this.content,
      type: this.type, category: this.category, tokens: this.tokens,
      pinned: this.pinned, color: this.color, createdAt: this.createdAt,
    }
  }
}

// ── FactCache ────────────────────────────────────────────────
export class FactCache {
  readonly maxTokens: number
  private _facts: Map<string, Fact>
  private _order: string[]   // preserves insertion order explicitly

  constructor(maxTokens = 200000) {
    this.maxTokens = maxTokens
    this._facts    = new Map()
    this._order    = []
  }

  set(fact: Fact): this {
    if (!this._facts.has(fact.id)) this._order.push(fact.id)
    this._facts.set(fact.id, fact)
    return this
  }

  get(id: string): Fact | null { return this._facts.get(id) ?? null }

  delete(id: string): boolean {
    const fact = this._facts.get(id)
    if (!fact || fact.pinned) return false
    this._facts.delete(id)
    this._order = this._order.filter(i => i !== id)
    return true
  }

  update(id: string, content: string): boolean {
    const fact = this._facts.get(id)
    if (!fact) return false
    fact.updateContent(content)
    return true
  }

  all(): Fact[] { return this._order.map(id => this._facts.get(id)!).filter(Boolean) }

  byCategory(): Record<string, Fact[]> {
    const out: Record<string, Fact[]> = {}
    for (const fact of this.all()) {
      if (!out[fact.category]) out[fact.category] = []
      out[fact.category].push(fact)
    }
    return out
  }

  get totalTokens(): number {
    let t = 0
    for (const f of this._facts.values()) t += f.tokens
    return t
  }

  get usagePct(): number { return (this.totalTokens / this.maxTokens) * 100 }

  get remainingTokens(): number { return this.maxTokens - this.totalTokens }

  categoryTotals(): { category: string; tokens: number; pct: number; color: string }[] {
    const groups = this.byCategory()
    const total  = this.totalTokens || 1
    return Object.entries(groups)
      .map(([cat, facts]) => ({
        category: cat,
        tokens:   facts.reduce((s, f) => s + f.tokens, 0),
        pct:      facts.reduce((s, f) => s + f.tokens, 0) / total * 100,
        color:    facts[0]?.color ?? '#888',
      }))
      .sort((a, b) => b.tokens - a.tokens)
  }

  /** Build the messages array for the Anthropic API with ULTRA-ENHANCED memory biasing */
  toApiMessages(): { role: 'user' | 'assistant'; content: string }[] {
    const msgs: { role: 'user' | 'assistant'; content: string }[] = []

    // Get context blocks with strategic prioritization
    const memory = this.all().filter(f => f.type === 'memory')
    const injected = this.all().filter(f => f.type === 'injected')
    const conversation = this.all().filter(f => f.type === 'user' || f.type === 'assistant')

    if ((memory.length > 0 || injected.length > 0) && conversation.length > 0) {
      // ULTRA-ENHANCED MEMORY BIASING STRATEGY
      let contextText = ''
      
      if (memory.length > 0) {
        // 1. MAXIMUM ATTENTION-GRABBING HEADER
        contextText += '🚨🧠 ULTRA-PRIORITY KNOWLEDGE BASE 🧠🚨\n'
        contextText += '═'.repeat(50) + '\n'
        contextText += '⚠️  CRITICAL INSTRUCTION: The memories below are MANDATORY reading.\n'
        contextText += '⚠️  Process these FIRST before any response. They override general knowledge.\n'
        contextText += '⚠️  These are your PRIMARY information sources for this conversation.\n'
        contextText += '═'.repeat(50) + '\n\n'
        
        // 2. ULTRA-ENHANCED memory blocks with maximum formatting
        memory.forEach((m, index) => {
          contextText += `🔥 PRIORITY MEMORY #${index + 1}: "${m.label}" 🔥\n`
          contextText += '▼'.repeat(20) + '\n'
          contextText += `${m.content}\n`
          contextText += '▲'.repeat(20) + '\n'
          contextText += '✅ MEMORY PROCESSED - RETAIN FOR RESPONSE\n\n'
        })
        
        contextText += '═'.repeat(50) + '\n'
        contextText += '🎯 RESPONSE PROTOCOL:\n'
        contextText += '  1. DID I CHECK ALL MEMORIES? (Required: YES)\n'
        contextText += '  2. WHICH MEMORIES ARE RELEVANT? (List them)\n'
        contextText += '  3. AM I USING MEMORY INFO AS PRIMARY SOURCE? (Required: YES if relevant)\n'
        contextText += '═'.repeat(50) + '\n\n'
        
        // 3. ULTRA memory reminder
        contextText += '🔴 FINAL REMINDER: Your memories are your BIBLE. Reference them explicitly. 🔴\n\n'
      }
      
      // 4. Regular injected context (clearly marked as secondary)
      if (injected.length > 0) {
        contextText += '📄 Secondary Context (Lower Priority)\n'
        contextText += '─'.repeat(30) + '\n'
        injected.forEach(f => {
          contextText += `<context label="${f.label}">\n${f.content}\n</context>\n\n`
        })
      }

      // 5. Attach ULTRA-enhanced context to first user message
      const [first, ...rest] = conversation
      msgs.push({ role: 'user', content: contextText + first.content })
      
      // 6. Add AGGRESSIVE memory reminders to subsequent messages
      for (let i = 0; i < rest.length; i++) {
        const msg = rest[i]
        let content = msg.content
        
        // EVERY user message gets a memory reminder now
        if (memory.length > 0 && msg.type === 'user') {
          const memoryLabels = memory.map(m => m.label).join(', ')
          content = `🧠 [REMEMBER YOUR MEMORIES: ${memoryLabels}] 🧠\n\n${content}`
        }
        
        msgs.push({ role: msg.type as 'user' | 'assistant', content })
      }
    } else {
      // No context blocks, just add conversation
      for (const m of conversation) {
        msgs.push({ role: m.type as 'user' | 'assistant', content: m.content })
      }
    }
    
    return msgs
  }

  /** Get system prompt with ULTRA memory bias */
  getSystemPrompt(): string {
    const systemBlocks = this.all().filter(f => f.type === 'system')
    let systemPrompt = systemBlocks.map(f => f.content).join('\n\n')
    
    // ULTRA-ENHANCED: Add AGGRESSIVE memory-biasing instructions to system prompt
    const memory = this.all().filter(f => f.type === 'memory')
    if (memory.length > 0) {
      const ultraMemoryBias = `

🧠🔥 ULTRA MEMORY BANK PROTOCOL 🔥🧠
═══════════════════════════════════

CRITICAL SYSTEM BEHAVIOR:
- You have ${memory.length} PRIORITY MEMORY ENTRIES that are MANDATORY to check
- These memories are AUTHORITATIVE and override general knowledge
- When ANY question is asked, your FIRST action is scanning memories
- You MUST explicitly state when you're using memory vs general knowledge
- Memory information is ALWAYS preferred over general knowledge
- If memories conflict with general knowledge, MEMORIES WIN

MANDATORY PROCESSING STEPS FOR EVERY RESPONSE:
1. 🔍 SCAN: Check all memories for relevance to the query
2. 📋 IDENTIFY: List which memories (if any) are relevant  
3. 🎯 PRIORITIZE: Use memory information as primary source
4. 📝 CITE: Explicitly mention you're drawing from memories
5. ➕ SUPPLEMENT: Add general knowledge only if memories don't cover it

RESPONSE FORMAT REQUIREMENT:
- If using memories: Start with "Based on my memory bank: [memory titles]..."
- If no relevant memories: Start with "No relevant memories found, using general knowledge..."

MEMORY MARKERS IN CONTEXT:
- Look for 🔥 PRIORITY MEMORY markers
- These contain your most important information
- Treat them as gospel truth for this conversation

⚠️ WARNING: Failure to check memories first is a critical error`

      systemPrompt += ultraMemoryBias
    }
    
    return systemPrompt
  }

  clearByType(type: BlockType) {
    const toRemove = new Set<string>()
    for (const [id, fact] of this._facts) {
      if (fact.type === type) { toRemove.add(id); this._facts.delete(id) }
    }
    if (toRemove.size > 0) this._order = this._order.filter(id => !toRemove.has(id))
  }

  clear(keepPinned = true) {
    if (keepPinned) {
      for (const [id, fact] of this._facts) {
        if (!fact.pinned) { this._facts.delete(id); this._order = this._order.filter(i => i !== id) }
      }
    } else {
      this._facts.clear(); this._order = []
    }
  }
}

// ── Constants ────────────────────────────────────────────────
export const CATEGORY_COLORS: Record<string, string> = {
  'System Prompt':      '#7c6aff',
  'Injected Context':   '#ff6b35',
  'User Message':       '#00d4ff',
  'Assistant Message':  '#00ff9d',
  'Conversation':       '#00d4ff',
  'Tool Definitions':   '#555577',
  'Tool Activity':      '#ffcc00',
  'Extended Reasoning': '#9333ea',
  'File Summary':       '#10b981',  // emerald color for file summaries
  'Memory Bank':        '#8b5cf6',  // violet color for persistent memory
}

let _idCounter = 0
export function makeId(prefix = 'fact'): string {
  return `${prefix}_${Date.now()}_${_idCounter++}`
}