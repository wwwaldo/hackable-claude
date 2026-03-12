// electron/main.js
// Electron entry point. Spawns the Vite+Express dev server, then opens a
// BrowserWindow once Vite is ready. Kills the child on quit.

import { app, BrowserWindow, shell } from 'electron'
import { spawn }  from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath }    from 'url'
import http from 'http'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const ROOT       = resolve(__dirname, '..')   // project root
const VITE_URL   = 'http://localhost:5173'
const VITE_READY_TIMEOUT = 30000   // ms to wait for Vite before giving up

let devProcess   = null
let mainWindow   = null

// ── Spawn dev server ─────────────────────────────────────────
function spawnDevServer() {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

  devProcess = spawn(npmCmd, ['run', 'dev'], {
    cwd:   ROOT,
    shell: false,
    env:   { ...process.env, FORCE_COLOR: '0' },
    // Don't inherit stdio — we capture it so Electron's console stays clean
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  devProcess.stdout.on('data', d => {
    const line = d.toString().trim()
    if (line) console.log('[dev]', line)
  })
  devProcess.stderr.on('data', d => {
    const line = d.toString().trim()
    if (line) console.error('[dev:err]', line)
  })
  devProcess.on('exit', code => {
    console.log(`[dev] exited with code ${code}`)
  })
}

// ── Poll until Vite is up ────────────────────────────────────
function waitForVite(timeout = VITE_READY_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const start    = Date.now()
    const interval = 300

    function attempt() {
      http.get(VITE_URL, res => {
        res.resume()
        if (res.statusCode < 500) {
          resolve()
        } else {
          retry()
        }
      }).on('error', retry)
    }

    function retry() {
      if (Date.now() - start > timeout) {
        reject(new Error(`Vite didn't start within ${timeout}ms`))
        return
      }
      setTimeout(attempt, interval)
    }

    attempt()
  })
}

// ── Create window ────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1400,
    height:          900,
    minWidth:        900,
    minHeight:       600,
    titleBarStyle:   'hiddenInset',   // macOS: traffic lights inset into content
    backgroundColor: '#080810',
    webPreferences: {
      nodeIntegration:     false,
      contextIsolation:    true,
      webSecurity:         false,     // allow localhost:5173 ↔ localhost:3001 without CORS issues
    },
    title: 'Hackable Claude',
    show:  false,   // show after ready-to-show to avoid white flash
  })

  mainWindow.loadURL(VITE_URL)

  // Show once content is rendered
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  // Open external links in system browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── App lifecycle ────────────────────────────────────────────
app.whenReady().then(async () => {
  console.log('[electron] starting dev server…')
  spawnDevServer()

  console.log('[electron] waiting for Vite…')
  try {
    await waitForVite()
    console.log('[electron] Vite ready, opening window')
    createWindow()
  } catch (e) {
    console.error('[electron] failed to start:', e.message)
    app.quit()
  }
})

// Re-open window on macOS dock click
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Quit app when all windows closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Kill dev server on quit — critical, otherwise orphan processes linger
app.on('will-quit', () => {
  if (devProcess) {
    console.log('[electron] killing dev server…')
    // Kill the entire process group so concurrently's children die too
    try {
      process.kill(-devProcess.pid, 'SIGTERM')
    } catch {
      devProcess.kill('SIGTERM')
    }
    devProcess = null
  }
})
