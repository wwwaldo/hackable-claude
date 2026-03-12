// src/persistence.ts
// Saves and loads the full app state to ~/.hackable-claude/session.json
// via the Express file API. Called from App.tsx on load and after each message.

import { FactCache, Fact, CATEGORY_COLORS } from './factcache'
import { FILE_API } from './api'

export interface PersistedMessage {
  id:      string
  role:    'user' | 'assistant'
  content: string
  tokens?: number
}

export interface PersistedBlock {
  id:       string
  label:    string
  content:  string
  type:     string
  category: string
  tokens:   number
  pinned:   boolean
  color:    string
}

export interface SessionData {
  version:        number
  savedAt:        string
  systemPrompt:   string
  messages:       PersistedMessage[]
  injectedBlocks: PersistedBlock[]
  settings: {
    toolsEnabled: boolean
    model:        string
  }
}

// ── Save ─────────────────────────────────────────────────────

export async function saveSession(
  cache:        FactCache,
  messages:     PersistedMessage[],
  toolsEnabled: boolean,
  model:        string,
): Promise<void> {
  try {
    const systemPrompt   = cache.getSystemPrompt()
    const injectedBlocks = cache.all()
      .filter(f => f.type === 'injected')
      .map(f => ({
        id:       f.id,
        label:    f.label,
        content:  f.content,
        type:     f.type,
        category: f.category,
        tokens:   f.tokens,
        pinned:   f.pinned,
        color:    f.color,
      }))

    const payload: Omit<SessionData, 'version' | 'savedAt'> = {
      systemPrompt,
      messages,
      injectedBlocks,
      settings: { toolsEnabled, model },
    }

    await fetch(`${FILE_API}/api/session`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
  } catch (e) {
    console.warn('[persistence] save failed:', e)
  }
}

// ── Load ─────────────────────────────────────────────────────

export interface LoadedSession {
  systemPrompt:   string
  messages:       PersistedMessage[]
  injectedBlocks: PersistedBlock[]
  settings: {
    toolsEnabled: boolean
    model:        string
  }
}

export async function loadSession(): Promise<LoadedSession | null> {
  try {
    const r = await fetch(`${FILE_API}/api/session`)
    if (!r.ok) return null
    const data = await r.json()
    if (!data.exists || !data.session) return null
    return data.session as LoadedSession
  } catch (e) {
    console.warn('[persistence] load failed:', e)
    return null
  }
}

// ── Hydrate cache from loaded session ────────────────────────
// Restores injected blocks into the cache. Conversation messages
// are stored in React state directly (not in cache, since cache
// is used for building API messages, not display state).

export function hydrateCache(cache: FactCache, session: LoadedSession): void {
  // Update system prompt block
  const sysFact = cache.get('system_prompt')
  if (sysFact && session.systemPrompt) {
    sysFact.updateContent(session.systemPrompt)
  }

  // Re-add injected blocks
  for (const block of session.injectedBlocks ?? []) {
    cache.set(new Fact({
      id:       block.id,
      label:    block.label,
      content:  block.content,
      type:     block.type as any,
      category: block.category as any,
      tokens:   block.tokens,
      pinned:   block.pinned,
      color:    block.color || CATEGORY_COLORS[block.category] || '#888',
    }))
  }

  // Re-add conversation messages into cache so toApiMessages() works
  for (const msg of session.messages ?? []) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      cache.set(new Fact({
        id:       msg.id,
        label:    msg.role === 'user' ? 'User' : 'Assistant',
        content:  msg.content,
        type:     msg.role,
        category: msg.role === 'user' ? 'User Message' : 'Assistant Message',
        tokens:   msg.tokens ?? Fact.estimateTokens(msg.content),
        pinned:   false,
        color:    CATEGORY_COLORS[msg.role === 'user' ? 'User Message' : 'Assistant Message'],
      }))
    }
  }
}

// ── Clear session ─────────────────────────────────────────────

export async function clearSession(): Promise<void> {
  try {
    await fetch(`${FILE_API}/api/session`, { method: 'DELETE' })
  } catch (e) {
    console.warn('[persistence] clear failed:', e)
  }
}
