/* global window, document, requestAnimationFrame */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const root = fileURLToPath(new URL('../../../../', import.meta.url))
const baseline = process.env.FILETERM_PERF_BASELINE === '1'
const source = await build({
  stdin: {
    resolveDir: root,
    loader: 'ts',
    contents: `
import { registerTerminalSymbolGlyphRenderer } from './apps/tauri/src/renderer/xterm-adapters/terminal-symbol-glyph-renderer'
import { registerTerminalBlockGlyphRenderer } from './apps/tauri/src/renderer/xterm-adapters/terminal-block-glyph-renderer'
import { getRendererWorkSnapshot, resetRendererWork } from './apps/tauri/src/renderer/lib/renderer-work-log'
window.registerSymbol=registerTerminalSymbolGlyphRenderer;window.registerBlock=registerTerminalBlockGlyphRenderer;window.work=getRendererWorkSnapshot;window.resetWork=resetRendererWork;
`
  },
  bundle: true,
  write: false,
  logLevel: 'silent',
  plugins: baseline
    ? [
        {
          name: 'baseline',
          setup(builder) {
            builder.onLoad({ filter: /terminal-(block|symbol)-glyph-renderer\.ts$/ }, (args) => ({
              contents: execFileSync(
                'git',
                [
                  'show',
                  `${process.env.FILETERM_PERF_BASELINE_REF || 'HEAD'}:apps/tauri/src/renderer/xterm-adapters/${args.path.split(/[/\\]/).at(-1)}`
                ],
                { cwd: root, encoding: 'utf8' }
              ),
              loader: 'ts',
              resolveDir: args.path.replace(/[/\\][^/\\]+$/, '')
            }))
          }
        }
      ]
    : []
})
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 }, deviceScaleFactor: 1.25 })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setContent('<main id="host"></main>')
  await page.addStyleTag({ path: root + 'node_modules/@xterm/xterm/css/xterm.css' })
  const font = readFileSync(
    root + 'apps/tauri/src/renderer/assets/fonts/text/jetbrains-mono/JetBrainsMono-400.ttf'
  ).toString('base64')
  await page.addStyleTag({ content: `@font-face{font-family:TestMono;src:url(data:font/ttf;base64,${font})}` })
  await page.evaluate(() => document.fonts.load('16px TestMono'))
  await page.addScriptTag({ path: root + 'node_modules/@xterm/xterm/lib/xterm.js' })
  await page.addScriptTag({ content: source.outputFiles[0].text })
  await page.evaluate(async () => {
    const terminal = new window.Terminal({
      cols: 120,
      rows: 30,
      fontFamily: 'TestMono',
      fontSize: 16,
      allowProposedApi: true,
      theme: { background: '#111', foreground: '#ddd' }
    })
    terminal.open(document.getElementById('host'))
    window.terminal = terminal
    window.symbol = window.registerSymbol(terminal)
    window.block = window.registerBlock(terminal)
    const line = Array.from({ length: 10 }, (_, i) => '\x1b[' + (31 + (i % 6)) + 'm✻─┬█ ▢⚠ ').join('') + '\x1b[0m'
    await new Promise((resolve) =>
      terminal.write(Array.from({ length: 30 }, (_, i) => '\x1b[' + (i + 1) + ';1H' + line).join(''), resolve)
    )
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    window.refresh = () =>
      new Promise((resolve) => {
        const subscription = terminal.onRender(() => {
          subscription.dispose()
          requestAnimationFrame(resolve)
        })
        terminal.refresh(0, 29)
      })
  })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const metrics = async () =>
    Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  const before = await metrics()
  const result = await page.evaluate(async () => {
    window.resetWork()
    const started = performance.now()
    for (let i = 0; i < 120; i++) await window.refresh()
    const work = window.work()
    const copied = window.terminal.buffer.active.getLine(0).translateToString(true)
    return {
      elapsedMs: performance.now() - started,
      work,
      copied,
      canvases: document.querySelectorAll('.xterm-block-glyph-row').length
    }
  })
  const after = await metrics()
  result.layoutCount = after.LayoutCount - before.LayoutCount
  result.layoutMs = 1000 * (after.LayoutDuration - before.LayoutDuration)
  console.log(JSON.stringify({ baseline, ...result }))
  if (process.env.FILETERM_DOM_LAYOUT_OUTPUT)
    writeFileSync(process.env.FILETERM_DOM_LAYOUT_OUTPUT, JSON.stringify({ baseline, ...result }, null, 2))
  assert.deepEqual(errors, [])
  assert.equal(result.canvases, 30)
  assert.match(result.copied, /✻─┬█ ▢⚠/)
  if (!baseline) {
    assert.ok(
      result.work.phases['symbol-layout'].calls <= 125,
      'adapter-owned block wrappers must not rescan symbol rows'
    )
    assert.ok(result.layoutCount <= 300, 'cached fonts and the calibrated grid must avoid another layout flush')
  }
  // Direct row replacement is how xterm updates selection outside onRender.
  const direct = await page.evaluate(async () => {
    window.terminal._core._renderService._renderer.value.renderRows(0, 0)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const row = window.terminal.element.querySelector('.xterm-rows').firstElementChild
    const fitted = row.querySelectorAll('.xterm-fitted-symbol-source').length
    window.block.dispose()
    window.symbol.dispose()
    window.terminal.dispose()
    return fitted
  })
  assert.ok(direct > 0, 'selection row replacements must retain symbol fitting')
} finally {
  await browser.close()
}
