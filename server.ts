// server.ts — File API sidecar for Hackable Claude
// Runs on port 3001 alongside Vite (port 5173)

import express  from 'express'
import cors     from 'cors'
import fs       from 'fs'
import path     from 'path'
import os       from 'os'
import { fileURLToPath } from 'url'

const __dirname    = path.dirname(fileURLToPath(import.meta.url))
const PORT         = 3001
const SESSION_DIR  = path.join(os.homedir(), '.hackable-claude')
const SESSION_FILE = path.join(SESSION_DIR, 'session.json')

const ALLOWED_EXTENSIONS = ['.ts', '.tsx', '.css', '.json', '.html', '.md']
const BLOCKED_PATHS      = ['node_modules', 'dist', '.git', '.backups']

// ── In-memory message store ───────────────────────────────────
// Holds the live conversation state. App pushes updates here on
// every send; Claude can read and rewrite via get/edit_messages.
interface LiveMessage {
  id:      string
  role:    'user' | 'assistant'
  content: string
  tokens?: number
}

let liveMessages: LiveMessage[] = []
let messagesVersion = 0   // incremented on every write, lets client detect changes cheaply

const app = express()
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }))
app.use(express.json({ limit: '50mb' }))

// ── Helpers ──────────────────────────────────────────────────

function isAllowed(filePath: string): boolean {
  const ext = path.extname(filePath)
  const rel  = path.relative(__dirname, filePath)
  if (BLOCKED_PATHS.some(b => rel.split(path.sep).includes(b))) return false
  if (!filePath.startsWith(__dirname)) return false
  return ALLOWED_EXTENSIONS.includes(ext)
}

function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4)
}

interface FileEntry {
  path: string; size: number; tokens: number; lines: number; modified: string
}

function walkDir(dir: string): FileEntry[] {
  const entries: FileEntry[] = []
  if (!fs.existsSync(dir)) return entries
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel  = path.relative(__dirname, full).replace(/\\/g, '/')
    if (BLOCKED_PATHS.some(b => rel.split('/').includes(b))) continue
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      entries.push(...walkDir(full))
    } else if (isAllowed(full)) {
      const content = fs.readFileSync(full, 'utf-8')
      entries.push({ path: rel, size: stat.size, tokens: estimateTokens(content), lines: content.split('\n').length, modified: stat.mtime.toISOString() })
    }
  }
  return entries
}

function backup(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const backupDir = path.join(__dirname, '.backups')
  fs.mkdirSync(backupDir, { recursive: true })
  const rel = path.relative(__dirname, filePath).replace(/\//g, '_').replace(/\\/g, '_')
  const ts  = new Date().toISOString().replace(/[:.]/g, '-')
  fs.copyFileSync(filePath, path.join(backupDir, `${rel}.${ts}.bak`))
}

// ── Routes: file ops ─────────────────────────────────────────

app.get('/api/files', (_req, res) => {
  try {
    const files = walkDir(__dirname)
    res.json({ files, total_tokens: files.reduce((s, f) => s + f.tokens, 0), total_files: files.length })
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

app.post('/api/file-read', (req, res) => {
  const { path: rel } = req.body
  if (!rel || typeof rel !== 'string') return res.status(400).json({ error: 'path required' })
  const filePath = path.join(__dirname, rel)
  if (!isAllowed(filePath)) return res.status(403).json({ error: 'Not allowed' })
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: `Not found: ${rel}` })
  const content = fs.readFileSync(filePath, 'utf-8')
  res.json({ path: rel, content, tokens: estimateTokens(content), lines: content.split('\n').length })
})

app.post('/api/file-write', (req, res) => {
  const { path: rel, content } = req.body
  if (!rel || typeof rel !== 'string') return res.status(400).json({ error: 'path required' })
  if (typeof content !== 'string') return res.status(400).json({ error: 'content must be string' })
  const filePath = path.join(__dirname, rel)
  if (!isAllowed(filePath)) return res.status(403).json({ error: 'Not allowed' })
  backup(filePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
  console.log(`[file-api] wrote ${rel} (${content.split('\n').length} lines, ${estimateTokens(content)} tok)`)
  res.json({ ok: true, path: rel, tokens: estimateTokens(content), lines: content.split('\n').length })
})

// Legacy GET route
app.get('/api/files/*', (req, res) => {
  const rel      = (req.params as any)[0] as string
  const filePath = path.join(__dirname, rel)
  if (!isAllowed(filePath)) return res.status(403).json({ error: 'Not allowed' })
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: `Not found: ${rel}` })
  const content = fs.readFileSync(filePath, 'utf-8')
  res.json({ path: rel, content, tokens: estimateTokens(content), lines: content.split('\n').length })
})

app.get('/api/backups', (_req, res) => {
  const backupDir = path.join(__dirname, '.backups')
  if (!fs.existsSync(backupDir)) return res.json({ backups: [] })
  const backups = fs.readdirSync(backupDir)
    .map(name => { const stat = fs.statSync(path.join(backupDir, name)); return { name, size: stat.size, modified: stat.mtime.toISOString() } })
    .sort((a, b) => b.modified.localeCompare(a.modified))
  res.json({ backups })
})

// ── Routes: session persistence ──────────────────────────────
// Session lives in ~/.hackable-claude/session.json
// Shape: { version, savedAt, systemPrompt, messages, injectedBlocks, settings }

app.get('/api/session', (_req, res) => {
  try {
    if (!fs.existsSync(SESSION_FILE)) {
      return res.json({ exists: false })
    }
    const raw     = fs.readFileSync(SESSION_FILE, 'utf-8')
    const session = JSON.parse(raw)
    console.log(`[session] loaded (${session.messages?.length ?? 0} messages)`)
    res.json({ exists: true, session })
  } catch (e) {
    console.error('[session] load error:', e)
    res.json({ exists: false, error: String(e) })
  }
})

app.post('/api/session', (req, res) => {
  try {
    const session = {
      version:        1,
      savedAt:        new Date().toISOString(),
      ...req.body,
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true })
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), 'utf-8')
    console.log(`[session] saved (${session.messages?.length ?? 0} messages, ${SESSION_FILE})`)
    res.json({ ok: true })
  } catch (e) {
    console.error('[session] save error:', e)
    res.status(500).json({ error: String(e) })
  }
})

app.delete('/api/session', (_req, res) => {
  try {
    if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE)
    liveMessages = []
    messagesVersion++
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

// ── Routes: live message history ──────────────────────────────

// GET /api/messages — return current messages + version
app.get('/api/messages', (_req, res) => {
  res.json({
    messages: liveMessages,
    version:  messagesVersion,
    count:    liveMessages.length,
  })
})

// POST /api/messages — App pushes state here after every send
// Also used by Claude's edit_messages tool to rewrite history
app.post('/api/messages', (req, res) => {
  const { messages, reason } = req.body
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be array' })

  // Validate each message has required fields
  for (const m of messages) {
    if (!m.id || !m.role || typeof m.content !== 'string') {
      return res.status(400).json({ error: `Invalid message: ${JSON.stringify(m)}` })
    }
    if (m.role !== 'user' && m.role !== 'assistant') {
      return res.status(400).json({ error: `Invalid role: ${m.role}` })
    }
  }

  const prev = liveMessages.length
  liveMessages = messages
  messagesVersion++

  if (reason) {
    console.log(`[messages] edited: ${prev} → ${messages.length} messages. Reason: ${reason}`)
  }

  res.json({ ok: true, version: messagesVersion, count: messages.length })
})

app.listen(PORT, () => {
  console.log(`[file-api] http://localhost:${PORT}`)
  console.log(`[session]  ${SESSION_FILE}`)
})
