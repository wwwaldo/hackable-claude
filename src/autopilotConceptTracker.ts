// Enhanced concept tracking specifically designed for autopilot mode
// Combines persistent attention tracking with step-by-step progression analysis

export interface ConceptCacheState {
  added: string[]
  removed: string[]
  cache: string[]
}

export interface ConceptEvolution {
  step: number
  stepsRemaining: number
  concepts: string[]
  added: string[]
  removed: string[]
  timestamp: number
  progressNote?: string
}

export interface AutopilotConceptAnalysis {
  evolution: ConceptEvolution[]
  persistentConcepts: string[]
  emergingConcepts: string[]
  fadingConcepts: string[]
  attentionStability: number
  cognitiveLoadTrend: 'increasing' | 'decreasing' | 'stable'
}

export class AutopilotConceptTracker {
  private evolution: ConceptEvolution[] = []
  private currentCache: string[] = []
  private totalSteps: number = 0

  // Initialize tracking for a new autopilot session
  initializeSession(totalSteps: number, objective: string): void {
    this.evolution = []
    this.currentCache = ['autopilot-objective'] // Always start with the objective
    this.totalSteps = totalSteps
    
    // Record initial state
    this.recordEvolution(totalSteps, [], ['autopilot-objective'], `Starting autopilot: ${objective}`)
  }

  // Extract concept cache from assistant response using the JSON format from previous conversation
  extractConceptCache(content: string): ConceptCacheState | null {
    try {
      // Look for the JSON wrapper from the previous conversation format
      const jsonMatch = content.match(/\{[\s\S]*"cache":\s*\{[\s\S]*?\}[\s\S]*?\}$/)
      if (!jsonMatch) return null

      const jsonData = JSON.parse(jsonMatch[0])
      if (!jsonData.cache) return null

      return {
        added: jsonData.cache.added || [],
        removed: jsonData.cache.removed || [],
        cache: jsonData.cache.cache || []
      }
    } catch (error) {
      console.warn('Failed to parse concept cache from message:', error)
      return null
    }
  }

  // Update tracking with new message content
  updateFromAutopilotStep(content: string, stepsRemaining: number, progressNote?: string): void {
    const cacheState = this.extractConceptCache(content)
    if (!cacheState) return

    // Validate cache changes make sense
    const expectedCache = [...this.currentCache]
    
    // Remove concepts
    cacheState.removed.forEach(concept => {
      const index = expectedCache.indexOf(concept)
      if (index !== -1) expectedCache.splice(index, 1)
    })
    
    // Add new concepts
    cacheState.added.forEach(concept => {
      if (!expectedCache.includes(concept)) {
        expectedCache.push(concept)
      }
    })

    // Update current cache
    this.currentCache = cacheState.cache

    // Record this evolution step
    this.recordEvolution(
      stepsRemaining, 
      cacheState.added, 
      cacheState.removed, 
      progressNote
    )
  }

  private recordEvolution(
    stepsRemaining: number, 
    added: string[], 
    removed: string[], 
    progressNote?: string
  ): void {
    const step = this.totalSteps - stepsRemaining
    
    this.evolution.push({
      step,
      stepsRemaining,
      concepts: [...this.currentCache],
      added: [...added],
      removed: [...removed],
      timestamp: Date.now(),
      progressNote
    })
  }

  // Analyze the full autopilot concept evolution
  analyzeEvolution(): AutopilotConceptAnalysis {
    if (this.evolution.length === 0) {
      return {
        evolution: [],
        persistentConcepts: [],
        emergingConcepts: [],
        fadingConcepts: [],
        attentionStability: 0,
        cognitiveLoadTrend: 'stable'
      }
    }

    // Find concepts that appeared in multiple steps
    const conceptFrequency = new Map<string, number>()
    this.evolution.forEach(step => {
      step.concepts.forEach(concept => {
        conceptFrequency.set(concept, (conceptFrequency.get(concept) || 0) + 1)
      })
    })

    const persistent = Array.from(conceptFrequency.entries())
      .filter(([, freq]) => freq >= Math.max(2, this.evolution.length * 0.4))
      .map(([concept]) => concept)

    // Find concepts that emerged later but stuck around
    const emerging: string[] = []
    const fading: string[] = []

    this.evolution.forEach((step, index) => {
      step.added.forEach(concept => {
        // Check if this concept persists for multiple steps after being added
        const remainingSteps = this.evolution.slice(index + 1)
        const persistsCount = remainingSteps.filter(s => s.concepts.includes(concept)).length
        if (persistsCount >= Math.min(2, remainingSteps.length * 0.5)) {
          emerging.push(concept)
        }
      })

      step.removed.forEach(concept => {
        // Check if this concept was around for a while before being removed
        const priorSteps = this.evolution.slice(0, index)
        const priorPresence = priorSteps.filter(s => s.concepts.includes(concept)).length
        if (priorPresence >= 2) {
          fading.push(concept)
        }
      })
    })

    // Calculate attention stability (lower values = more concept churn)
    const totalChanges = this.evolution.reduce((sum, step) => \n      sum + step.added.length + step.removed.length, 0)\n    const stability = Math.max(0, 1 - (totalChanges / (this.evolution.length * 5)))\n\n    // Analyze cognitive load trend by looking at concept count over time\n    const conceptCounts = this.evolution.map(step => step.concepts.length)\n    const early = conceptCounts.slice(0, Math.max(1, conceptCounts.length / 3))\n    const late = conceptCounts.slice(-Math.max(1, conceptCounts.length / 3))\n    \n    const earlyAvg = early.reduce((sum, count) => sum + count, 0) / early.length\n    const lateAvg = late.reduce((sum, count) => sum + count, 0) / late.length\n    \n    let cognitiveLoadTrend: 'increasing' | 'decreasing' | 'stable' = 'stable'\n    if (lateAvg > earlyAvg * 1.2) cognitiveLoadTrend = 'increasing'\n    else if (lateAvg < earlyAvg * 0.8) cognitiveLoadTrend = 'decreasing'\n\n    return {\n      evolution: [...this.evolution],\n      persistentConcepts: Array.from(new Set(persistent)),\n      emergingConcepts: Array.from(new Set(emerging)),\n      fadingConcepts: Array.from(new Set(fading)),\n      attentionStability: stability,\n      cognitiveLoadTrend\n    }\n  }\n\n  // Get current concept state\n  getCurrentConcepts(): string[] {\n    return [...this.currentCache]\n  }\n\n  // Get evolution history\n  getEvolution(): ConceptEvolution[] {\n    return [...this.evolution]\n  }\n\n  // Clear all tracking data\n  clear(): void {\n    this.evolution = []\n    this.currentCache = []\n    this.totalSteps = 0\n  }\n\n  // Export analysis as formatted text for context injection\n  exportAnalysis(): string {\n    const analysis = this.analyzeEvolution()\n    \n    if (analysis.evolution.length === 0) {\n      return 'No autopilot concept evolution data available.'\n    }\n\n    const lines = [\n      '🧠 AUTOPILOT CONCEPT EVOLUTION ANALYSIS',\n      '=' .repeat(50),\n      '',\n      `📊 **Attention Stability**: ${(analysis.attentionStability * 100).toFixed(1)}%`,\n      `🔄 **Cognitive Load Trend**: ${analysis.cognitiveLoadTrend}`,\n      `📈 **Total Steps Tracked**: ${analysis.evolution.length}`,\n      '',\n      '🎯 **Persistent Concepts** (maintained across multiple steps):',\n      ...analysis.persistentConcepts.map(c => `  • ${c}`),\n      '',\n      '🌱 **Emerging Concepts** (gained traction during execution):',\n      ...analysis.emergingConcepts.map(c => `  • ${c}`),\n      '',\n      '🍃 **Fading Concepts** (lost attention over time):',\n      ...analysis.fadingConcepts.map(c => `  • ${c}`),\n      '',\n      '📋 **Step-by-Step Evolution**:',\n      ...analysis.evolution.map(step => {\n        const changeStr = step.added.length > 0 || step.removed.length > 0 \n          ? ` (+${step.added.join(', ')} -${step.removed.join(', ')})`\n          : ' (no changes)'\n        return `  Step ${step.step}: [${step.concepts.join(', ')}]${changeStr}`\n      }),\n    ]\n\n    return lines.join('\\n')\n  }\n}\n\n// Singleton instance for global use\nexport const autopilotConceptTracker = new AutopilotConceptTracker()\n