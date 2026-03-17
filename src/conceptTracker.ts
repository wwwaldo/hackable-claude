// Concept tracking utility for extracting and managing conversation concepts

export interface ConceptData {
  concepts: string[]
}

export class ConceptTracker {
  private recentConcepts: string[] = []
  private maxRecent: number = 5

  // Extract concepts from message content using regex
  extractConcepts(content: string): string[] {
    // Look for the JSON pattern at the end of assistant messages
    const conceptMatch = content.match(/\{"concepts":\s*\[(.*?)\]\}/)
    if (!conceptMatch) return []

    try {
      // Parse the concepts array from the matched JSON
      const conceptsStr = conceptMatch[1]
      const concepts = conceptsStr
        .split(',')
        .map(c => c.trim().replace(/"/g, ''))
        .filter(c => c.length > 0)
      
      return concepts
    } catch (error) {
      console.warn('Failed to parse concepts from message:', error)
      return []
    }
  }

  // Update recent concepts with new ones from a message
  updateFromMessage(content: string): void {
    const newConcepts = this.extractConcepts(content)
    if (newConcepts.length > 0) {
      // Add new concepts to the front, remove duplicates, and limit to maxRecent
      const updated = [
        ...newConcepts,
        ...this.recentConcepts.filter(c => !newConcepts.includes(c))
      ].slice(0, this.maxRecent)
      
      this.recentConcepts = updated
    }
  }

  // Get the most recent concepts
  getRecentConcepts(): string[] {
    return [...this.recentConcepts]
  }

  // Clear all tracked concepts
  clear(): void {
    this.recentConcepts = []
  }

  // Get concept count
  getConceptCount(): number {
    return this.recentConcepts.length
  }
}