import { Fact } from './factcache'
const estimateTokens = Fact.estimateTokens

export interface MemoryEntry {
  id: string
  label: string
  content: string
  tokens: number
  timestamp: number
  category: 'conversation' | 'insight' | 'code' | 'reference' | 'other'
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
        
        // Load all memory files
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

        // Sort by timestamp (newest first)
        this.entries.sort((a, b) => b.timestamp - a.timestamp)
        
        // Trim if over token limit
        this.trimToTokenLimit()
        
        console.log(`MemoryBank initialized with ${this.entries.length} entries (${this.getTotalTokens()} tokens)`)
      }
    } catch (error) {
      console.error('Failed to initialize MemoryBank:', error)
    }
  }

  async addEntry(label: string, content: string, category: MemoryEntry['category'] = 'other'): Promise<string> {
    const tokens = estimateTokens(content)
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label,
      content,
      tokens,
      timestamp: Date.now(),
      category
    }

    // Add to memory
    this.entries.unshift(entry)
    
    // Trim if needed
    this.trimToTokenLimit()
    
    // Persist to file
    await this.saveEntry(entry)
    
    return entry.id
  }

  async removeEntry(id: string): Promise<boolean> {
    const index = this.entries.findIndex(e => e.id === id)
    if (index === -1) return false

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

    entry.label = label
    entry.content = content
    entry.tokens = estimateTokens(content)
    entry.timestamp = Date.now()

    // Move to front (most recently updated)
    this.entries = [entry, ...this.entries.filter(e => e.id !== id)]
    
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

  getTotalTokens(): number {
    return this.entries.reduce((sum, entry) => sum + entry.tokens, 0)
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
    let totalTokens = this.getTotalTokens()
    
    while (totalTokens > this.maxTokens && this.entries.length > 0) {
      // Remove oldest entries first
      const removed = this.entries.pop()
      if (removed) {
        totalTokens -= removed.tokens
        // Also delete the file
        fetch(`http://localhost:3001/memorybank/delete/${removed.id}`, { method: 'DELETE' })
          .catch(error => console.error(`Failed to delete trimmed memory file ${removed.id}:`, error))
      }
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

    return {
      totalEntries: this.entries.length,
      totalTokens: this.getTotalTokens(),
      maxTokens: this.maxTokens,
      utilizationPercent: Math.round((this.getTotalTokens() / this.maxTokens) * 100),
      categoryCounts: categories,
      oldestEntry: this.entries[this.entries.length - 1]?.timestamp,
      newestEntry: this.entries[0]?.timestamp
    }
  }
}