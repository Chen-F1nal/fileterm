/* global window, document */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { terminalSymbolTable } from '../fixtures/terminal-symbol-table.mjs'

const require = createRequire(import.meta.url)
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const root = fileURLToPath(new URL('../../../../', import.meta.url))
const directory = mkdtempSync(join(tmpdir(), 'fileterm-resize-repaint-'))
writeFileSync(
  join(directory, 'fixture.tsx'),
  `
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Terminal } from '@xterm/xterm'
import { TerminalView } from '${root}apps/tauri/src/renderer/components/terminal-view'
import '${root}apps/tauri/src/renderer/styles/index.css'
const open = Terminal.prototype.open
Terminal.prototype.open = function(host) {
  window.terminal = this
  this.onRender(() => window.renders++)
  return open.call(this, host)
}
function Fixture() {
  const [width, setWidth] = useState(900)
  const [height, setHeight] = useState(700)
  const [active, setActive] = useState(true)
  window.setWidth = (value) => flushSync(() => setWidth(value))
  window.setHeight = (value) => flushSync(() => setHeight(value))
  window.setActive = (value) => flushSync(() => setActive(value))
  return <div style={{width, maxWidth:'calc(100vw - 80px)', height, visibility: active ? 'visible' : 'hidden'}}>
    <TerminalView profileId="profile" tabId="tab" sessionType="ssh" connected={true} isActive={active}
      bootText="fixture shell\\r\\n$ " onActivate={() => {}}/>
  </div>
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`
)
await build({
  configFile: false,
  root,
  plugins: [react()],
  logLevel: 'error',
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  resolve: {
    alias: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@xterm/xterm'].map((name) => ({
      find: new RegExp('^' + name + '$'),
      replacement: require.resolve(name)
    }))
  },
  build: {
    lib: {
      entry: join(directory, 'fixture.tsx'),
      name: 'TerminalResizeFixture',
      formats: ['iife'],
      fileName: () => 'bundle.js',
      cssFileName: 'bundle'
    },
    outDir: join(directory, 'dist')
  }
})
const engine = process.env.PLAYWRIGHT_ENGINE === 'webkit' ? webkit : chromium
let browser
try {
  browser = await engine.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH
  })
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setContent(
    '<html data-platform="win32" data-theme="fileterm-light"><body><div id="root"></div></body></html>'
  )
  await page.evaluate(() => {
    window.renders = 0
    window.sizes = []
    window.fileterm = {
      platform: 'win32',
      getUiPreferences: async () => ({ terminalZoomLocked: false }),
      getUiStateItem: async () => null,
      setUiStateItem: async () => {},
      onUiPreferencesChanged: () => () => {},
      onTerminalData: (handler) => {
        window.output = handler
        return () => {}
      },
      onTerminalState: () => () => {},
      onTerminalZoomRequest: () => () => {},
      onTerminalGestureZoomRequest: () => () => {},
      resizeTerminal: async (tabId, cols, rows, width, height) =>
        window.sizes.push({ tabId, cols, rows, width, height }),
      writeDiagnosticLog: async () => {},
      writeTerminal: async () => {}
    }
  })
  await page.addStyleTag({ content: readFileSync(join(directory, 'dist/bundle.css'), 'utf8') })
  await page.addScriptTag({ content: readFileSync(join(directory, 'dist/bundle.js'), 'utf8') })
  await page.waitForFunction(() => window.terminal && window.sizes.length > 0 && window.output)
  await page.evaluate(async (table) => {
    await document.fonts.ready
    await window.output({ tabId: 'tab', chunk: '\x1b[H\x1b[2J' + table })
  }, terminalSymbolTable)
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    window.setActive(false)
    window.setWidth(600)
  })
  await page.waitForTimeout(200)
  const activation = await page.evaluate(() => {
    window.setActive(true)
    return {
      host: document.querySelector('.terminal-inner').getBoundingClientRect().width,
      screen: document.querySelector('.xterm-screen').getBoundingClientRect().width
    }
  })
  assert.ok(
    activation.screen <= activation.host + 1,
    'activation must fit the cached terminal before the first visible frame'
  )
  await page.evaluate(() => window.setWidth(900))
  await page.waitForTimeout(250)
  const gpu = await page.evaluate(() => {
    const terminal = window.terminal
    const renderer = terminal._core._renderService._renderer.value
    if (!renderer._gl) return false
    window.unpaintedResizes = []
    let paints = 0
    const render = renderer.renderRows
    renderer.renderRows = function (...args) {
      paints++
      return render.apply(this, args)
    }
    const resize = terminal.resize
    terminal.resize = function (cols, rows) {
      const changed = this.cols !== cols || this.rows !== rows
      const before = paints
      resize.call(this, cols, rows)
      if (changed)
        queueMicrotask(() => {
          if (paints === before) window.unpaintedResizes.push({ cols, rows })
        })
    }
    return true
  })
  assert.ok(gpu, 'the resize regression must exercise the real WebGL renderer')
  for (const height of [640, 580, 520, 600, 700]) {
    await page.evaluate((height) => window.setHeight(height), height)
    await page.waitForTimeout(40)
  }
  assert.deepEqual(
    await page.evaluate(() => window.unpaintedResizes),
    [],
    'vertical resizing must repaint the cleared WebGL canvas before the next browser paint'
  )
  const before = await page.evaluate(() => ({ renders: window.renders, cols: window.terminal.cols }))
  await page.evaluate(() => window.setWidth(910))
  await page.waitForFunction((renders) => window.renders > renders, before.renders, { timeout: 600 })
  await page.waitForTimeout(250)
  await page.evaluate((table) => {
    window.terminal.input('\r', true)
    window.outputTimer = window.setInterval(() => {
      void window.output({ tabId: 'tab', chunk: '\x1b[H' + table })
    }, 40)
    window.setWidth(600)
  }, terminalSymbolTable)
  await page.waitForFunction(
    (cols) => window.terminal.cols < cols && window.sizes.at(-1).cols === window.terminal.cols,
    before.cols,
    { timeout: 1200 }
  )
  assert.ok(
    await page.evaluate(() => Boolean(window.outputTimer)),
    'resize must commit while the TUI is still producing output'
  )
  for (const width of [1100, 720, 1000]) {
    await page.evaluate(() => window.setWidth(1000))
    await page.setViewportSize({ width, height: 850 })
    await page.waitForFunction(
      () => {
        const host = document.querySelector('.terminal-inner')
        const size = window.sizes.at(-1)
        return size.width === Math.floor(host.getBoundingClientRect().width) && size.cols === window.terminal.cols
      },
      undefined,
      { timeout: 1200 }
    )
    const geometry = await page.evaluate(() => ({
      host: document.querySelector('.terminal-inner').getBoundingClientRect().width,
      screen: document.querySelector('.xterm-screen').getBoundingClientRect().width
    }))
    assert.ok(geometry.screen <= geometry.host + 1, 'settled rows must fit the new pane/window width')
  }
  await page.evaluate(() => {
    window.clearInterval(window.outputTimer)
    window.outputTimer = null
  })
  await page.waitForTimeout(400)
  const settled = await page.evaluate(() => ({ renders: window.renders, resizes: window.sizes.length }))
  await page.waitForTimeout(250)
  assert.equal(await page.evaluate(() => window.sizes.length), settled.resizes, 'idle must not reschedule PTY resizing')
  assert.deepEqual(errors, [])
  console.log(
    'PASS: pane and window resizing repaints and synchronizes the xterm/PTY grid during continuous TUI output'
  )
} finally {
  await browser?.close()
  rmSync(directory, { recursive: true, force: true })
}
