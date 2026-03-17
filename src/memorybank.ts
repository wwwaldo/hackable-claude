import { Fact } from './factcache'
const estimateTokens = Fact.estimateTokens

export interface MemoryEntry {
  id: string
  label: string
  content: string
  tokens: number
  timestamp: number
  category: 'conversation' | 'insight' | 'code' | 'reference' | 'other'
  isReadonly?: boolean  // For local memory files that can't be edited
}

export class MemoryBank {
  private entries: MemoryEntry[] = []
  private maxTokens: number = 50000
  private baseDir: string

  constructor(baseDir: string = '') {
    this.baseDir = baseDir
  }

  async initialize(): Promise<void> {
    try {
      // Clear existing entries to prevent duplicates
      this.entries = []
      
      const response = await fetch('http://localhost:3001/memorybank/list')
      if (response.ok) {
        const files = await response.json()
        
        // Load all memory files (both local: and user: prefixed)
        for (const file of files) {
          try {
            const entryResponse = await fetch(`http://localhost:3001/memorybank/read/${file}`)
            if (entryResponse.ok) {
              const entry: MemoryEntry = await entryResponse.json()
              this.entries.push(entry)
            }
          } catch (error) {
            console.error(`Failed to load memory entry ${file}:`, error)
          }
        }

        // Sort by timestamp (newest first), but put local entries first
        this.entries.sort((a, b) => {
          // Local entries first
          if (a.isReadonly && !b.isReadonly) return -1
          if (!a.isReadonly && b.isReadonly) return 1
          // Then by timestamp (newest first)
          return b.timestamp - a.timestamp
        })
        
        // Trim user entries if over token limit (but keep all local entries)
        this.trimToTokenLimit()
        
        console.log(`MemoryBank initialized with ${this.entries.length} entries (${this.getTotalTokens()} tokens)`)
        console.log(`  - Local: ${this.entries.filter(e => e.isReadonly).length}`)
        console.log(`  - User: ${this.entries.filter(e => !e.isReadonly).length}`)
      }
    } catch (error) {
      console.error('Failed to initialize MemoryBank:', error)
    }
  }

  async addEntry(label: string, content: string, category: MemoryEntry['category'] = 'other'): Promise<string> {
    const tokens = estimateTokens(content)
    const entry: MemoryEntry = {
      id: `user:mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label,
      content,
      tokens,
      timestamp: Date.now(),
      category,
      isReadonly: false
    }

    // Add to memory
    this.entries.unshift(entry)
    
    // Trim if needed (but only user entries)
    this.trimToTokenLimit()
    
    // Persist to file
    await this.saveEntry(entry)
    
    return entry.id
  }

  async removeEntry(id: string): Promise<boolean> {
    const index = this.entries.findIndex(e => e.id === id)
    if (index === -1) return false

    const entry = this.entries[index]
    
    // Don't allow deleting local entries
    if (entry.isReadonly) {
      console.warn(`Cannot delete readonly memory entry: ${id}`)
      return false
    }

    this.entries.splice(index, 1)
    
    // Remove file
    try {
      await fetch(`http://localhost:3001/memorybank/delete/${id}`, { method: 'DELETE' })
    } catch (error) {
      console.error(`Failed to delete memory file ${id}:`, error)
    }
    
    return true
  }

  async updateEntry(id: string, label: string, content: string): Promise<boolean> {
    const entry = this.entries.find(e => e.id === id)
    if (!entry) return false

    // Don't allow updating local entries
    if (entry.isReadonly) {
      console.warn(`Cannot update readonly memory entry: ${id}`)
      return false
    }

    entry.label = label
    entry.content = content
    entry.tokens = estimateTokens(content)
    entry.timestamp = Date.now()

    // Move to front (most recently updated) among user entries
    const localEntries = this.entries.filter(e => e.isReadonly)
    const userEntries = this.entries.filter(e => !e.isReadonly)
    const updatedUserEntries = [entry, ...userEntries.filter(e => e.id !== id)]
    this.entries = [...localEntries, ...updatedUserEntries]
    
    // Trim if needed
    this.trimToTokenLimit()
    
    // Persist changes
    await this.saveEntry(entry)
    
    return true
  }

  getEntries(): MemoryEntry[] {
    return [...this.entries]
  }

  getEntriesByCategory(category: MemoryEntry['category']): MemoryEntry[] {
    return this.entries.filter(e => e.category === category)
  }

  getLocalEntries(): MemoryEntry[] {
    return this.entries.filter(e => e.isReadonly)
  }

  getUserEntries(): MemoryEntry[] {
    return this.entries.filter(e => !e.isReadonly)
  }

  getTotalTokens(): number {
    return this.entries.reduce((sum, entry) => sum + entry.tokens, 0)
  }

  getUserTokens(): number {
    return this.entries.filter(e => !e.isReadonly).reduce((sum, entry) => sum + entry.tokens, 0)
  }

  getEntry(id: string): MemoryEntry | undefined {
    return this.entries.find(e => e.id === id)
  }

  search(query: string): MemoryEntry[] {
    const lowercaseQuery = query.toLowerCase()
    return this.entries.filter(entry => 
      entry.label.toLowerCase().includes(lowercaseQuery) ||
      entry.content.toLowerCase().includes(lowercaseQuery)
    )
  }

  private trimToTokenLimit(): void {
    let userTokens = this.getUserTokens()
    const localTokens = this.entries.filter(e => e.isReadonly).reduce((sum, e) => sum + e.tokens, 0)
    
    // Only trim user entries if they exceed the limit (allowing for local entries)
    const availableTokens = Math.max(0, this.maxTokens - localTokens)
    
    while (userTokens > availableTokens && this.entries.length > 0) {
      // Find the oldest user entry
      let oldestIndex = -1
      let oldestTime = Date.now()
      
      for (let i = 0; i < this.entries.length; i++) {
        const entry = this.entries[i]
        if (!entry.isReadonly && entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp
          oldestIndex = i
        }
      }
      
      if (oldestIndex === -1) break // No user entries to remove
      
      // Remove oldest user entry
      const removed = this.entries.splice(oldestIndex, 1)[0]
      userTokens -= removed.tokens
      
      // Also delete the file
      fetch(`http://localhost:3001/memorybank/delete/${removed.id}`, { method: 'DELETE' })
        .catch(error => console.error(`Failed to delete trimmed memory file ${removed.id}:`, error))
    }
  }

  private async saveEntry(entry: MemoryEntry): Promise<void> {
    try {
      await fetch(`http://localhost:3001/memorybank/save/${entry.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entry)
      })
    } catch (error) {
      console.error(`Failed to save memory entry ${entry.id}:`, error)
    }
  }

  // Export all entries for backup/analysis
  exportEntries(): string {
    return JSON.stringify(this.entries, null, 2)
  }

  // Get stats
  getStats() {
    const categories = this.entries.reduce((acc, entry) => {
      acc[entry.category] = (acc[entry.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const localEntries = this.getLocalEntries()
    const userEntries = this.getUserEntries()

    return {
      totalEntries: this.entries.length,
      localEntries: localEntries.length,
      userEntries: userEntries.length,
      totalTokens: this.getTotalTokens(),
      localTokens: localEntries.reduce((sum, e) => sum + e.tokens, 0),
      userTokens: userEntries.reduce((sum, e) => sum + e.tokens, 0),
      maxTokens: this.maxTokens,
      utilizationPercent: Math.round((this.getTotalTokens() / this.maxTokens) * 100),
      userUtilizationPercent: Math.round((this.getUserTokens() / Math.max(1, this.maxTokens - localEntries.reduce((sum, e) => sum + e.tokens, 0))) * 100),
      categoryCounts: categories,
      oldestEntry: this.entries[this.entries.length - 1]?.timestamp,
      newestEntry: this.entries[0]?.timestamp
    }
  }
}