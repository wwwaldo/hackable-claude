import { useState, useEffect, useRef, useCallback } from 'react'
import { FactCache, Fact, makeId, CATEGORY_COLORS } from './factcache'
import { ChatPane } from './components/ChatPane'
import { ContextPane } from './components/ContextPane'
import { ToolPane, ToolEvent } from './components/ToolPane'
import { streamMessage, MODEL, TOOLS_DEFINITION_TEXT, FILE_API } from './api'
import { saveSession, loadSession, hydrateCache, clearSession, PersistedMessage } from './persistence'
import { useTheme } from './theme'

export default function App() {
  const [messages, setMessages]               = useState<PersistedMessage[]>([])
  const [streaming, setStreaming]              = useState(false)
  const [streamText, setStreamText]            = useState('')
  const [streamThinking, setStreamThinking]    = useState('')
  const [toolEvents, setToolEvents]            = useState<ToolEvent[]>([])
  const [apiKey, setApiKey]                    = useState(() => localStorage.getItem('hc_api_key') || '')
  const [toolsEnabled, setToolsEnabled]        = useState(true)
  const [serverOnline, setServerOnline]        = useState(false)
  const [extendedReasoning, setExtendedReasoning] = useState(() =>
    localStorage.getItem('extendedReasoning') === 'true'
  )
  const [apiTokens, setApiTokens]              = useState<number | undefined>()

  const cache    = useRef(new FactCache()).current
  const abortRef = useRef<AbortController | null>(null)
  const { theme, toggleTheme } = useTheme()

  // Persist API key
  useEffect(() => {
    if (apiKey) localStorage.setItem('hc_api_key', apiKey)
    else localStorage.removeItem('hc_api_key')
  }, [apiKey])

  // Persist extended reasoning preference
  useEffect(() => {
    localStorage.setItem('extendedReasoning', extendedReasoning.toString())
  }, [extendedReasoning])

  // Check server status
  useEffect(() => {
    let mounted = true
    async function ping() {
      try {
        const r = await fetch(`${FILE_API}/api/files`)
        if (mounted) setServerOnline(r.ok)
      } catch {
        if (mounted) setServerOnline(false)
      }
    }
    ping()
    const interval = setInterval(ping, 5000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  // Load session on startup
  useEffect(() => {
    loadSession().then(session => {
      if (session) {
        setMessages(session.messages)
        hydrateCache(cache, session)
        if (session.settings?.toolsEnabled !== undefined) {
          setToolsEnabled(session.settings.toolsEnabled)
        }
      }
    })
  }, [])

  // Initialize cache with system prompt and tool definitions
  useEffect(() => {
    if (!cache.get('system_prompt')) {
      cache.set(new Fact({
        id: 'system_prompt',
        label: 'System Prompt',
        content: 'You are a helpful coding assistant. You have access to tools that let you read, write, and list files in your own codebase. Use them when asked to inspect or modify code.',
        type: 'system',
        category: 'System Prompt',
        tokens: Fact.estimateTokens('You are a helpful coding assistant...'),
        pinned: true,
        color: CATEGORY_COLORS['System Prompt'],
      }))
    }
    if (!cache.get('tool_defs') && toolsEnabled) {
      cache.set(new Fact({
        id: 'tool_defs',
        label: 'Tool Definitions',
        content: TOOLS_DEFINITION_TEXT,
        type: 'tool-defs',
        category: 'Tool Definitions',
        tokens: Fact.estimateTokens(TOOLS_DEFINITION_TEXT),
        pinned: true,
        color: CATEGORY_COLORS['Tool Definitions'],
      }))
    }
  }, [toolsEnabled])

  // Save session when state changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveSession(cache, messages, toolsEnabled, MODEL)
    }, 1000)
    return () => clearTimeout(timer)
  }, [messages, toolsEnabled])

  // Sync messages into cache for context window display
  const syncMessagesToCache = useCallback((msgs: PersistedMessage[]) => {
    cache.clearByType('user')
    cache.clearByType('assistant')
    for (const msg of msgs) {
      cache.set(new Fact({
        id: msg.id,
        label: msg.role === 'user' ? 'User' : 'Assistant',
        content: msg.content,
        type: msg.role,
        category: msg.role === 'user' ? 'User Message' : 'Assistant Message',
        tokens: msg.tokens ?? Fact.estimateTokens(msg.content),
        pinned: false,
        color: CATEGORY_COLORS[msg.role === 'user' ? 'User Message' : 'Assistant Message'],
      }))
    }
  }, [cache])

  useEffect(() => {
    syncMessagesToCache(messages)
  }, [messages, syncMessagesToCache])

  async function handleSend(text: string) {
    if (!text.trim() || streaming || !apiKey) return

    const userMsg: PersistedMessage = {
      id: makeId('user'),
      role: 'user',
      content: text.trim(),
      tokens: Fact.estimateTokens(text.trim()),
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setStreaming(true)
    setStreamText('')
    setStreamThinking('')
    setToolEvents([])
    cache.clearByType('tool-turn')

    const systemPrompt = cache.getSystemPrompt()
    const apiMessages = cache.toApiMessages()
    apiMessages.push({ role: 'user', content: text.trim() })

    const abort = new AbortController()
    abortRef.current = abort

    let finalText = ''
    let finalThinking = ''

    try {
      await streamMessage(
        apiKey,
        systemPrompt,
        apiMessages,
        {
          onToken: (token) => {
            setStreamText(prev => prev + token)
          },
          onTurnText: (_text) => {
            // Turn text fires when a turn completes before tool calls
          },
          onToolCall: (call) => {
            setToolEvents(prev => [...prev, {
              id: call.id,
              type: 'call',
              call,
              ts: Date.now(),
            }])
          },
          onToolResult: (result) => {
            setToolEvents(prev => [...prev, {
              id: `result-${result.id}`,
              type: 'result',
              result,
              ts: Date.now(),
            }])

            cache.set(new Fact({
              id: makeId('tool'),
              label: `Tool: ${result.name}`,
              content: result.output.slice(0, 2000),
              type: 'tool-turn',
              category: 'Tool Activity',
              tokens: Fact.estimateTokens(result.output.slice(0, 2000)),
              pinned: false,
              color: CATEGORY_COLORS['Tool Activity'],
            }))
          },
          onThinking: (thinking) => {
            setStreamThinking(prev => prev + thinking)
          },
          onDone: (text, inputTok, outputTok, thinking) => {
            finalText = text
            finalThinking = thinking || ''
            setApiTokens(inputTok)
          },
          onError: (err) => {
            console.error('Stream error:', err)
            finalText = `Error: ${err.message}`
          },
        },
        toolsEnabled && serverOnline,
        extendedReasoning,
        abort.signal,
      )
    } catch (error) {
      console.error('Stream error:', error)
      finalText = 'Error: Failed to get response'
    }

    if (finalText) {
      const assistantMsg: PersistedMessage = {
        id: makeId('assistant'),
        role: 'assistant',
        content: finalText,
        tokens: Fact.estimateTokens(finalText),
      }
      // Add thinking to message if present
      const msgWithThinking = finalThinking
        ? { ...assistantMsg, thinking: finalThinking }
        : assistantMsg
      setMessages(prev => [...prev, msgWithThinking as PersistedMessage])
    }

    setStreaming(false)
    setStreamText('')
    setStreamThinking('')
    abortRef.current = null
  }

  function handleDeleteMsg(id: string) {
    setMessages(prev => prev.filter(msg => msg.id !== id))
    cache.delete(id)
  }

  function handleEditMsg(id: string, content: string) {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, content, tokens: Fact.estimateTokens(content) } : msg
    ))
    cache.update(id, content)
  }

  function handleClearMessages() {
    setMessages([])
    cache.clearByType('user')
    cache.clearByType('assistant')
    cache.clearByType('tool-turn')
    setToolEvents([])
    setApiTokens(undefined)
  }

  function handleClearSession() {
    handleClearMessages()
    cache.clear(false)
    clearSession()
    // Re-init system prompt
    cache.set(new Fact({
      id: 'system_prompt',
      label: 'System Prompt',
      content: 'You are a helpful coding assistant. You have access to tools that let you read, write, and list files in your own codebase. Use them when asked to inspect or modify code.',
      type: 'system',
      category: 'System Prompt',
      tokens: Fact.estimateTokens('You are a helpful coding assistant...'),
      pinned: true,
      color: CATEGORY_COLORS['System Prompt'],
    }))
    if (toolsEnabled) {
      cache.set(new Fact({
        id: 'tool_defs',
        label: 'Tool Definitions',
        content: TOOLS_DEFINITION_TEXT,
        type: 'tool-defs',
        category: 'Tool Definitions',
        tokens: Fact.estimateTokens(TOOLS_DEFINITION_TEXT),
        pinned: true,
        color: CATEGORY_COLORS['Tool Definitions'],
      }))
    }
  }

  function handleSystemChange(content: string) {
    const sysFact = cache.get('system_prompt')
    if (sysFact) {
      sysFact.updateContent(content)
    } else {
      cache.set(new Fact({
        id: 'system_prompt',
        label: 'System Prompt',
        content,
        type: 'system',
        category: 'System Prompt',
        tokens: Fact.estimateTokens(content),
        pinned: true,
        color: CATEGORY_COLORS['System Prompt'],
      }))
    }
  }

  function handleInject(label: string, content: string) {
    cache.set(new Fact({
      id: makeId('injected'),
      label,
      content,
      type: 'injected',
      category: 'Injected Context',
      tokens: Fact.estimateTokens(content),
      pinned: false,
      color: CATEGORY_COLORS['Injected Context'],
    }))
  }

  function handleBlockUpdate(id: string, content: string) {
    cache.update(id, content)
  }

  function handleBlockDelete(id: string) {
    cache.delete(id)
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        <ChatPane
          messages={messages}
          streaming={streaming}
          streamText={streamText}
          streamThinking={streamThinking}
          extendedReasoning={extendedReasoning}
          onToggleExtendedReasoning={() => setExtendedReasoning(prev => !prev)}
          onSend={handleSend}
          onDeleteMsg={handleDeleteMsg}
          onEditMsg={handleEditMsg}
          onClearSession={handleClearSession}
          onClearMessages={handleClearMessages}
          apiKey={apiKey}
          onApiKeySet={setApiKey}
          model={MODEL}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <ContextPane
          cache={cache}
          apiTokens={apiTokens}
          onUpdate={handleBlockUpdate}
          onDelete={handleBlockDelete}
          onInject={handleInject}
          onSystemChange={handleSystemChange}
        />
      </div>
      <ToolPane
        events={toolEvents}
        serverOnline={serverOnline}
        toolsEnabled={toolsEnabled}
        onToggleTools={() => setToolsEnabled(prev => !prev)}
      />
    </div>
  )
}
