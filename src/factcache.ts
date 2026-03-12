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

  /** Build the messages array for the Anthropic API */
  toApiMessages(): { role: 'user' | 'assistant'; content: string }[] {
    const msgs: { role: 'user' | 'assistant'; content: string }[] = []

    // Injected context blocks get prepended to the first user message
    const injected = this.all().filter(f => f.type === 'injected')
    const memory = this.all().filter(f => f.type === 'memory')
    const conversation = this.all().filter(f => f.type === 'user' || f.type === 'assistant')

    if ((injected.length > 0 || memory.length > 0) && conversation.length > 0) {
      const contextBlocks = [...injected, ...memory]
      const contextText = contextBlocks.map(f => `<context label="${f.label}">\n${f.content}\n</context>`).join('\n\n')
      const [first, ...rest] = conversation
      msgs.push({ role: 'user', content: contextText + '\n\n' + first.content })
      for (const m of rest) msgs.push({ role: m.type as 'user' | 'assistant', content: m.content })
    } else {
      for (const m of conversation) {
        msgs.push({ role: m.type as 'user' | 'assistant', content: m.content })
      }
    }
    return msgs
  }

  /** Get system prompt (merged from all system/injected-as-system blocks) */
  getSystemPrompt(): string {
    return this.all()
      .filter(f => f.type === 'system')
      .map(f => f.content)
      .join('\n\n')
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