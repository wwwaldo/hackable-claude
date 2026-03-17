// api.ts — Anthropic streaming client with tool use support

export const MODEL = 'claude-sonnet-4-20250514'
export const FILE_API = 'http://localhost:3001'

export const CODEBASE_TOOLS = [
  {
    name: 'list_files',
    description: 'List all source files in the project with their token counts, line counts, and sizes. Call this first to understand the codebase before reading or modifying files.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'read_file',
    description: 'Read the full content of a source file. Use the path exactly as returned by list_files (e.g. "src/App.tsx", "server.ts").',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative file path e.g. "src/components/ChatPane.tsx"' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write new content to a source file. The original is automatically backed up before overwriting. Vite will hot-reload the app instantly after a write. IMPORTANT: write complete valid file content — never partial.',
    input_schema: {
      type: 'object',
      properties: {
        path:    { type: 'string', description: 'Relative file path to write' },
        content: { type: 'string', description: 'Complete new file content' },
        reason:  { type: 'string', description: 'Brief explanation of what changed and why' },
      },
      required: ['path', 'content', 'reason'],
    },
  },
  {
    name: 'list_backups',
    description: 'List available file backups that were auto-created before writes.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_messages',
    description: 'Get the current conversation message history. Each message has an id, role (user/assistant), content, and tokens. Use this before editing to see what messages exist and get their IDs.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'edit_messages',
    description: `Edit the conversation message history. You can delete messages, edit content, reorder, or insert new ones. Pass the complete desired messages array — it fully replaces the current history. The UI will update after your response finishes.

Rules:
- Each message must have: id (string), role ('user'|'assistant'), content (string)
- To delete: omit the message from the array
- To edit: include it with new content  
- To reorder: change the order in the array
- To insert: add a new object with a fresh id like 'injected_1'
- Always preserve message alternation (user/assistant/user/assistant)
- Your own current response will be appended after the edit — do not include it`,
    input_schema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          description: 'The complete new messages array',
          items: {
            type: 'object',
            properties: {
              id:      { type: 'string' },
              role:    { type: 'string', enum: ['user', 'assistant'] },
              content: { type: 'string' },
            },
            required: ['id', 'role', 'content'],
          },
        },
        reason: { type: 'string', description: 'Brief explanation of what you changed and why' },
      },
      required: ['messages', 'reason'],
    },
  },
  {
    name: 'patch_file',
    description: `Replace a specific string in a file with new content. Much more efficient than write_file for targeted edits — you only need to provide the old and new strings, not the entire file.

Rules:
- old_string must appear EXACTLY once in the file (include enough surrounding context to make it unique)
- old_string matching is exact — whitespace, indentation, and newlines must match precisely
- The file is automatically backed up before patching
- Use this instead of write_file whenever you're making a targeted edit rather than rewriting the whole file`,
    input_schema: {
      type: 'object',
      properties: {
        path:       { type: 'string', description: 'Relative file path to patch' },
        old_string: { type: 'string', description: 'The exact string to find and replace (must be unique in the file)' },
        new_string: { type: 'string', description: 'The replacement string' },
        reason:     { type: 'string', description: 'Brief explanation of what changed and why' },
      },
      required: ['path', 'old_string', 'new_string', 'reason'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for current information. Returns a summary of search results including titles, snippets, and URLs. Use this when you need up-to-date information, documentation, or answers that may not be in your training data.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch the text content of a URL. Returns the page body as plain text (HTML tags stripped). Use this to read documentation pages, articles, or any web content found via web_search.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch' },
      },
      required: ['url'],
    },
  },
  {
    name: 'autopilot_next',
    description: 'Generate the next user prompt for autonomous execution. Use this to continue autopilot mode with the next step toward your goal.',
    input_schema: {
      type: 'object',
      properties: {
        next_prompt: { 
          type: 'string', 
          description: 'The user prompt for the next autopilot iteration' 
        },
        progress_note: { 
          type: 'string', 
          description: 'Brief progress update for the human to track what you\'re doing' 
        },
        steps_remaining: { 
          type: 'number', 
          description: 'Decremented step count (subtract 1 from current)' 
        },
        status: {
          type: 'string',
          enum: ['continue', 'complete', 'error'],
          description: 'Whether to continue autopilot, mark complete, or stop due to error'
        }
      },
      required: ['next_prompt', 'progress_note', 'steps_remaining', 'status']
    }
  }
] as const

export const TOOLS_DEFINITION_TEXT = JSON.stringify(CODEBASE_TOOLS, null, 2)

export type ToolName = 'list_files' | 'read_file' | 'write_file' | 'patch_file' | 'list_backups' | 'get_messages' | 'edit_messages' | 'web_search' | 'web_fetch' | 'autopilot_next'

export interface ToolCall {
  id:    string
  name:  ToolName
  input: Record<string, unknown>
}

export interface ToolResult {
  id:     string
  name:   ToolName
  input:  Record<string, unknown>
  output: string
  error?: boolean
  fileSummary?: {  // Add file summary for read_file results
    path: string
    summary: string
    tokens: number
  }
}

// Helper function to generate file summary
function generateFileSummary(path: string, content: string): { summary: string; tokens: number } {
  const lines = content.split('\n').length
  const size = content.length
  
  // Extract key information for different file types
  let summary = `${path} (${lines} lines, ${Math.round(size/1000)}KB)`
  
  if (path.endsWith('.tsx') || path.endsWith('.ts')) {
    // Extract imports, exports, main functions/classes
    const imports = content.match(/^import .+$/gm) || []
    const exports = content.match(/^export .+$/gm) || []
    const functions = content.match(/(?:function|const)\s+(\w+)/g) || []
    const classes = content.match(/class\s+(\w+)/g) || []
    
    if (imports.length > 0) summary += `. Imports: ${imports.length} modules`
    if (exports.length > 0) summary += `. Exports: ${exports.length} items`
    if (functions.length > 0) summary += `. Functions: ${functions.slice(0, 3).map(f => f.split(' ').pop()).join(', ')}`
    if (classes.length > 0) summary += `. Classes: ${classes.map(c => c.split(' ')[1]).join(', ')}`
  } else if (path.endsWith('.css')) {
    const rules = content.match(/[^{}]+\{[^{}]*\}/g) || []
    summary += `. CSS rules: ${rules.length}`
  } else if (path.endsWith('.json')) {
    try {
      const json = JSON.parse(content)
      const keys = Object.keys(json)
      summary += `. Keys: ${keys.slice(0, 5).join(', ')}`
    } catch {
      summary += '. JSON structure'
    }
  }
  
  // Truncate summary to stay under 100 tokens (roughly 400 chars)
  if (summary.length > 350) {
    summary = summary.substring(0, 350) + '...'
  }
  
  return {
    summary,
    tokens: Math.ceil(summary.length / 4) // Rough token estimation
  }
}

// ── Execute tool calls against the file API ──────────────────
export async function executeTool(call: ToolCall): Promise<string> {
  try {
    switch (call.name) {
      case 'list_files': {
        const r = await fetch(`${FILE_API}/api/files`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return JSON.stringify(await r.json(), null, 2)
      }
      case 'read_file': {
        // Use a POST-style query to avoid URL encoding issues with paths
        const r = await fetch(`${FILE_API}/api/file-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: call.input.path }),
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${call.input.path}`)
        
        const data = await r.json()
        
        // Generate file summary for the context window
        if (data.content && typeof call.input.path === 'string') {
          const { summary, tokens } = generateFileSummary(call.input.path, data.content)
          
          // Add summary metadata to the result for the App to consume
          const result = {
            ...data,
            fileSummary: {
              path: call.input.path,
              summary,
              tokens
            }
          }
          return JSON.stringify(result, null, 2)
        }
        
        return JSON.stringify(data, null, 2)
      }
      case 'write_file': {
        // POST with path + content in body — avoids all URL encoding issues
        const r = await fetch(`${FILE_API}/api/file-write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: call.input.path, content: call.input.content, reason: call.input.reason }),
        })
        if (!r.ok) {
          const err = await r.text()
          throw new Error(`HTTP ${r.status}: ${err}`)
        }
        const d = await r.json()
        return JSON.stringify({ ok: d.ok, tokens: d.tokens, lines: d.lines, reason: call.input.reason })
      }
      case 'patch_file': {
        const r = await fetch(`${FILE_API}/api/file-patch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: call.input.path,
            old_string: call.input.old_string,
            new_string: call.input.new_string,
            reason: call.input.reason,
          }),
        })
        if (!r.ok) {
          const err = await r.text()
          throw new Error(`HTTP ${r.status}: ${err}`)
        }
        const d = await r.json()
        return JSON.stringify(d)
      }
      case 'list_backups': {
        const r = await fetch(`${FILE_API}/api/backups`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return JSON.stringify(await r.json(), null, 2)
      }
      case 'get_messages': {
        const r = await fetch(`${FILE_API}/api/messages`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return JSON.stringify(await r.json(), null, 2)
      }
      case 'edit_messages': {
        const r = await fetch(`${FILE_API}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: call.input.messages, reason: call.input.reason }),
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
        return JSON.stringify(await r.json(), null, 2)
      }
      case 'web_search': {
        const r = await fetch(`${FILE_API}/api/web-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: call.input.query }),
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
        return JSON.stringify(await r.json(), null, 2)
      }
      case 'web_fetch': {
        const r = await fetch(`${FILE_API}/api/web-fetch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: call.input.url }),
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
        return JSON.stringify(await r.json(), null, 2)
      }
      case 'autopilot_next': {
        // This tool doesn't make external API calls - it's handled by the frontend
        return JSON.stringify({
          success: true,
          next_prompt: call.input.next_prompt,
          progress_note: call.input.progress_note,
          steps_remaining: call.input.steps_remaining,
          status: call.input.status
        })
      }
      default:
        return JSON.stringify({ error: 'Unknown tool' })
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) })
  }
}

// ── Types ────────────────────────────────────────────────────
export interface StreamCallbacks {
  onToken:      (text: string) => void
  onTurnText:   (text: string) => void   // fires when a turn with text completes (before tool calls)
  onToolCall:   (call: ToolCall) => void
  onToolResult: (result: ToolResult) => void
  onThinking:   (thinking: string) => void  // fires when thinking content is streamed
  onDone:       (fullText: string, inputTokens: number, outputTokens: number, thinkingText?: string) => void
  onError:      (err: Error) => void
}

type ContentBlock =
  | { type: 'text';        text: string }
  | { type: 'thinking';    thinking: string }
  | { type: 'tool_use';    id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string }

type ApiMessage =
  | { role: 'user';      content: string | ContentBlock[] }
  | { role: 'assistant'; content: string | ContentBlock[] }

export async function streamMessage(
  apiKey:               string,
  systemPrompt:         string,
  messages:             { role: 'user' | 'assistant'; content: string }[],
  callbacks:            StreamCallbacks,
  enableTools:          boolean,
  enableExtendedReasoning: boolean = false,
  signal?:              AbortSignal,
) {
  const apiMessages: ApiMessage[] = messages.map(m => ({ role: m.role, content: m.content }))
  // accumulates full assistant text across all turns (tool use = multiple turns)
  await runTurn(apiKey, systemPrompt, apiMessages, callbacks, enableTools, enableExtendedReasoning, signal, '', 0, 0, '')
}

async function runTurn(
  apiKey:                  string,
  systemPrompt:            string,
  messages:                ApiMessage[],
  callbacks:               StreamCallbacks,
  enableTools:             boolean,
  enableExtendedReasoning: boolean,
  signal:                  AbortSignal | undefined,
  accText:                 string,   // accumulated text across recursive turns
  accInputTok:             number,
  accOutputTok:            number,
  accThinking:             string,   // accumulated thinking across turns
) {
  const body: Record<string, unknown> = {
    model: MODEL, max_tokens: 8192,
    system: systemPrompt || undefined,
    messages, stream: true,
  }
  if (enableTools) body.tools = CODEBASE_TOOLS
  if (enableExtendedReasoning) body.thinking = true

  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    callbacks.onError(e instanceof Error ? e : new Error(String(e)))
    return
  }

  if (!response.ok) {
    callbacks.onError(new Error(`API ${response.status}: ${await response.text()}`))
    return
  }

  const reader  = response.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  let turnText     = ''
  let turnThinking = ''
  let inputTokens  = 0
  let outputTokens = 0

  // tool_use blocks accumulate across streaming deltas, keyed by content block index
  const toolBlocks: Record<number, { id: string; name: string; inputJson: string }> = {}

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const evt = JSON.parse(data)

        if (evt.type === 'message_start')
          inputTokens = evt.message?.usage?.input_tokens ?? 0

        if (evt.type === 'message_delta')
          outputTokens = evt.usage?.output_tokens ?? 0

        if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use') {
          toolBlocks[evt.index] = { id: evt.content_block.id, name: evt.content_block.name, inputJson: '' }
        }

        if (evt.type === 'content_block_delta') {
          if (evt.delta?.type === 'text_delta') {
            turnText += evt.delta.text
            callbacks.onToken(evt.delta.text)
          }
          if (evt.delta?.type === 'thinking_delta') {
            turnThinking += evt.delta.thinking
            callbacks.onThinking(evt.delta.thinking)
          }
          if (evt.delta?.type === 'input_json_delta' && toolBlocks[evt.index] !== undefined) {
            toolBlocks[evt.index].inputJson += evt.delta.partial_json
          }
        }
      } catch { /* skip malformed SSE lines */ }
    }
  }

  const totalInputTok  = accInputTok  + inputTokens
  const totalOutputTok = accOutputTok + outputTokens
  const totalText      = accText + (accText && turnText ? '\n\n' : '') + turnText
  const totalThinking  = accThinking + (accThinking && turnThinking ? '\n\n' : '') + turnThinking

  const pendingCalls = Object.values(toolBlocks)

  if (pendingCalls.length > 0) {
    // FIX: if this turn had text before the tool call, surface it now so it
    // gets committed to messages state before we clear streamText
    if (turnText.trim()) {
      callbacks.onTurnText(turnText.trim())
    }

    const assistantBlocks: ContentBlock[] = []
    if (turnThinking) assistantBlocks.push({ type: 'thinking', thinking: turnThinking })
    if (turnText) assistantBlocks.push({ type: 'text', text: turnText })

    const toolResultBlocks: ContentBlock[] = []

    for (const tb of pendingCalls) {
      // FIX: parse inputJson safely — if it's truncated/malformed, use empty object
      let parsed: Record<string, unknown> = {}
      try {
        parsed = JSON.parse(tb.inputJson || '{}')
      } catch {
        // Try to recover partial JSON by appending closing brace
        try { parsed = JSON.parse(tb.inputJson + '}') } catch { /* give up, use {} */ }
      }

      const call: ToolCall = { id: tb.id, name: tb.name as ToolName, input: parsed }
      callbacks.onToolCall(call)
      assistantBlocks.push({ type: 'tool_use', id: tb.id, name: tb.name, input: parsed })

      const output = await executeTool(call)
      
      // Parse the result to check for file summary
      let resultData: any = {}
      try {
        resultData = JSON.parse(output)
      } catch { /* ignore parsing errors */ }
      
      const result: ToolResult = { 
        id: tb.id, 
        name: tb.name as ToolName, 
        input: parsed, 
        output,
        fileSummary: resultData.fileSummary // Pass through file summary if present
      }
      
      callbacks.onToolResult(result)
      toolResultBlocks.push({ type: 'tool_result', tool_use_id: tb.id, content: output })
    }

    const nextMessages: ApiMessage[] = [
      ...messages,
      { role: 'assistant', content: assistantBlocks },
      { role: 'user',      content: toolResultBlocks },
    ]

    await runTurn(
      apiKey, systemPrompt, nextMessages, callbacks, enableTools, enableExtendedReasoning, signal,
      totalText, totalInputTok, totalOutputTok, totalThinking,
    )
    return
  }

  callbacks.onDone(totalText, totalInputTok, totalOutputTok, totalThinking || undefined)
}