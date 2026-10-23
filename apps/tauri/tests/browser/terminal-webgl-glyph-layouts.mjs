/* global window, document, requestAnimationFrame */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarizeGpu } from './helpers/terminal-renderer-environment.mjs'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const archive = resolve(
  process.env.FILETERM_VALIDATION_ARCHIVE || join(root, '..', 'renderer-validation-archive', 'webgl-glyph-layouts')
)
const require = createRequire(import.meta.url)
const { build } = require(process.env.ESBUILD_MODULE_PATH || 'esbuild')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const dprs = process.env.FILETERM_WEBGL_DPR
  ? [Number(process.env.FILETERM_WEBGL_DPR)]
  : [1, 1.1, 1.2, 1.25, 1.3, 1.5, 1.75, 2, 2.5, 3]
assert.ok(dprs.every((dpr) => Number.isFinite(dpr) && dpr >= 1 && dpr <= 3))
const fonts = ['Consolas, monospace', '"JetBrains Mono", monospace', '"Courier New", monospace', 'Outfit, monospace']
const sizes = [...Array.from({ length: 21 }, (_, index) => index + 8), 32]
const layouts = [
  { name: 'wide', width: 1621, height: 901, columns: '1fr', rows: '1fr', panes: 1 },
  { name: 'compact', width: 803, height: 377, columns: '1fr', rows: '1fr', panes: 1 },
  { name: 'narrow', width: 247, height: 691, columns: '1fr', rows: '1fr', panes: 1 },
  { name: 'columns', width: 1379, height: 743, columns: '1fr 1.7fr', rows: '1fr', panes: 2 },
  { name: 'stacked', width: 999, height: 817, columns: '1fr', rows: '1fr 1.3fr', panes: 2 },
  { name: 'quad', width: 1439, height: 899, columns: '1fr 1fr', rows: '1fr 1fr', panes: 4 },
  { name: 'six', width: 1643, height: 917, columns: '1fr 1.2fr 0.8fr', rows: '1fr 1fr', panes: 6 }
]
const temporary = mkdtempSync(join(tmpdir(), 'fileterm-webgl-layouts-'))
const results = []
mkdirSync(archive, { recursive: true })
const save = () => writeFileSync(join(archive, 'matrix.json'), JSON.stringify(results, null, 2) + '\n')

try {
  await build({
    stdin: {
      resolveDir: root,
      loader: 'ts',
      contents: `
import { createTerminalLifecycleRuntime } from './apps/tauri/src/renderer/components/terminal-lifecycle-core'
import { setTerminalRendererPreference } from './apps/tauri/src/renderer/app/terminal-renderer-preference'
import { probeWebglGlyphEdges } from './apps/tauri/tests/browser/helpers/webgl-glyph-edge-probe.mjs'
import './apps/tauri/src/renderer/styles/index.css'
import '@xterm/xterm/css/xterm.css'
window.probeWebglGlyphEdges = probeWebglGlyphEdges
window.createRuntime = (host, renderer) => {
  setTerminalRendererPreference(renderer)
  const inner = document.createElement('div')
  inner.className = 'terminal-inner'
  host.append(inner)
  const runtime = createTerminalLifecycleRuntime({
    hostRef: { current: inner }, profileIdRef: { current: 'layout-fixture' }, tabIdRef: { current: 'layout-fixture' },
    terminalRef: { current: null }, fitAddonRef: { current: null }, searchAddonRef: { current: null },
    terminalLogColorizerRef: { current: null }, pendingWriteRef: { current: '' }, renderedTranscriptRef: { current: '' },
    isActiveRef: { current: true }, setTerminalScrollableElement: () => {}, isMac: false, isWindowsPty: false,
    buildTerminalTheme: () => ({ foreground: '#202020', background: '#ffffff' })
  })
  runtime.terminal.options.cursorBlink = false
  return {host, runtime}
}
`
    },
    bundle: true,
    minify: true,
    outfile: join(temporary, 'bundle.js'),
    define: { 'import.meta.env.DEV': 'false' },
    loader: { '.svg': 'dataurl', '.ttf': 'dataurl', '.woff2': 'dataurl', '.png': 'dataurl' },
    logLevel: 'silent'
  })
  for (const dpr of dprs) {
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      args: ['--enable-gpu', '--force-device-scale-factor=' + dpr, '--window-size=1800,1100']
    })
    try {
      const page = await browser.newPage({ viewport: null })
      const pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      await page.setContent('<main id="layout"></main>')
      await page.evaluate(() => {
        window.fileterm = { platform: 'win32', writeDiagnosticLog: () => Promise.resolve() }
      })
      await page.addStyleTag({ path: join(temporary, 'bundle.css') })
      await page.addScriptTag({ path: join(temporary, 'bundle.js') })
      await page.evaluate(async (fonts) => {
        await Promise.all(
          fonts.flatMap((font) => [400, 500, 700].map((weight) => document.fonts.load(`${weight} 16px ${font}`)))
        )
        await document.fonts.load('400 16px "Noto Sans SC"', '中文')
        await document.fonts.ready
        window.settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        window.disposeLayout = () => {
          for (const fixture of [...(window.peers || []), ...(window.reference ? [window.reference] : [])]) {
            fixture.runtime.disposeCore()
            fixture.host.remove()
          }
          window.peers = []
          window.reference = null
        }
        window.configure = (fixture, font, size, weight, theme, lineHeight = 1.05) => {
          const terminal = fixture.runtime.terminal
          terminal.options.fontFamily = font
          terminal.options.fontSize = size
          terminal.options.fontWeight = weight
          terminal.options.lineHeight = lineHeight
          terminal.options.theme = theme
          fixture.runtime.fitAddon.fit()
        }
        window.scene = async (fixture) => {
          const terminal = fixture.runtime.terminal
          const lines = [
            'FileTerm',
            '中文 e\u0301 🧪 ✻',
            '\x1b[1mBold\x1b[0m \x1b[3mItalic\x1b[0m \x1b[2mDim\x1b[0m',
            '█'.repeat(Math.min(12, terminal.cols - 1)),
            '┌─┬─┐ ▗▀▖',
            '\x1b[38;2;217;119;87mColor\x1b[0m \x1b[7mInverse\x1b[0m',
            '\x1b[4mUnderlined\x1b[0m'
          ]
          await new Promise((resolve) => terminal.write('\x1b[?25l\x1b[0m\x1b[2J\x1b[H' + lines.join('\r\n'), resolve))
        }
        window.readScene = (fixture) => {
          const terminal = fixture.runtime.terminal
          const renderer = terminal._core._renderService._renderer.value
          renderer.renderRows(0, terminal.rows - 1)
          const gl = renderer._gl
          const width = Math.min(gl.canvas.width, 500)
          const height = Math.min(gl.canvas.height, Math.ceil((gl.canvas.height / terminal.rows) * 7))
          const pixels = new Uint8Array(width * height * 4)
          gl.readPixels(0, gl.canvas.height - height, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
          return pixels
        }
        window.check = async ({ font, size, weight, theme, lineHeight = 1.05 }) => {
          const issues = []
          const observations = []
          for (const fixture of window.peers) window.configure(fixture, font, size, weight, theme, lineHeight)
          const first = window.peers[0]
          const bounds = first.host.getBoundingClientRect()
          window.reference.host.style.width = bounds.width + 'px'
          window.reference.host.style.height = bounds.height + 'px'
          window.configure(window.reference, font, size, weight, theme, lineHeight)
          await window.settle()
          for (const fixture of [...window.peers, window.reference]) fixture.runtime.fitAddon.fit()
          const edges = await Promise.all(
            window.peers.map(({ runtime }) => window.probeWebglGlyphEdges(runtime.terminal))
          )
          edges.forEach((edge, pane) => {
            if (
              edge.outsideGlyphPixels ||
              edge.misalignedGlyphs ||
              edge.error ||
              edge.fractionalAtlasGlyphs ||
              edge.atlasCell.some((value) => !Number.isInteger(value))
            )
              issues.push({ kind: 'glyph-edge', pane, ...edge })
            if (edge.viewport.some((value, i) => value !== [0, 0, ...edge.backing][i]))
              issues.push({ kind: 'viewport', pane })
          })
          const terminal = first.runtime.terminal
          const reference = window.reference.runtime.terminal
          if (reference._core._renderService._isPaused) throw new Error('DOM reference must remain in the viewport')
          const grid = [terminal.cols, terminal.rows]
          const referenceGrid = [reference.cols, reference.rows]
          if (grid.some((value, i) => value !== referenceGrid[i])) {
            const difference = { kind: 'fit-rounding', grid, referenceGrid }
            // FitAddon uses rounded cell sizes from each terminal's previous grid; retain known one-cell differences in the report.
            if (grid.some((value, i) => Math.abs(value - referenceGrid[i]) > 1)) issues.push(difference)
            else observations.push(difference)
          }
          reference.resize(terminal.cols, terminal.rows)
          const domCanvas = reference._core._renderService._renderer.value.dimensions.css.canvas
          const webglCanvas = terminal._core._renderService._renderer.value.dimensions.css.canvas
          if (Math.abs(domCanvas.width - webglCanvas.width) > 1 || Math.abs(domCanvas.height - webglCanvas.height) > 1)
            issues.push({ kind: 'dom-projection', domCanvas: { ...domCanvas }, webglCanvas: { ...webglCanvas } })
          const atlases = window.peers.map(
            ({ runtime }) => runtime.terminal._core._renderService._renderer.value._charAtlas
          )
          if (atlases.some((atlas) => atlas !== atlases[0])) issues.push({ kind: 'atlas-not-shared' })
          await Promise.all([...window.peers, window.reference].map(window.scene))
          await window.settle()
          const selectionLength = Math.min(8, terminal.cols)
          terminal.select(0, 0, selectionLength)
          if (terminal.getSelection() !== 'FileTerm'.slice(0, selectionLength)) issues.push({ kind: 'selection' })
          terminal.clearSelection()
          const screen = terminal.element.querySelector('.xterm-screen')
          const rect = screen.getBoundingClientRect()
          for (const column of [0, Math.floor(terminal.cols / 2), terminal.cols - 1]) {
            const coords = terminal._core._mouseService.getCoords(
              {
                clientX: rect.left + ((column + 0.5) * rect.width) / terminal.cols,
                clientY: rect.top + rect.height / terminal.rows / 2
              },
              screen,
              terminal.cols,
              terminal.rows,
              false
            )
            if (coords?.[0] !== column + 1 || coords?.[1] !== 1) issues.push({ kind: 'hit-test', column, coords })
          }
          const before = window.peers.map(window.readScene)
          const beforeImage =
            !window.repackProof && window.peers.length === 1
              ? terminal._core._renderService._renderer.value._gl.canvas.toDataURL()
              : null
          terminal.clearTextureAtlas()
          const changedPixels = window.peers.map((fixture, i) => {
            const after = window.readScene(fixture)
            let changed = 0
            for (let j = 0; j < after.length; j++) if (after[j] !== before[i][j]) changed++
            if (changed) {
              const examples = []
              const width = Math.min(
                fixture.runtime.terminal._core._renderService._renderer.value._gl.canvas.width,
                500
              )
              for (let j = 0; j < after.length && examples.length < 4; j += 4)
                if (after.slice(j, j + 4).some((value, channel) => value !== before[i][j + channel]))
                  examples.push({
                    x: (j / 4) % width,
                    y: Math.floor(j / 4 / width),
                    before: [...before[i].slice(j, j + 4)],
                    after: [...after.slice(j, j + 4)]
                  })
              issues.push({ kind: 'shared-repack', pane: i, changed, examples })
              if (beforeImage && !window.repackProof)
                window.repackProof = {
                  before: beforeImage,
                  after: terminal._core._renderService._renderer.value._gl.canvas.toDataURL()
                }
            }
            return changed
          })
          return { grid, referenceGrid, edges, changedPixels, issues, observations }
        }
      }, fonts)
      const cdp = await browser.newBrowserCDPSession()
      const { gpu } = await cdp.send('SystemInfo.getInfo')
      const result = { dpr, browser: browser.version(), gpu: summarizeGpu(gpu), cases: [], transitions: [], pageErrors }
      results.push(result)
      for (const layout of layouts) {
        await page.evaluate(async (layout) => {
          window.disposeLayout()
          const container = document.getElementById('layout')
          container.style.cssText = `display:grid;gap:7px;width:${layout.width}px;height:${layout.height}px;grid-template-columns:${layout.columns};grid-template-rows:${layout.rows}`
          for (let i = 0; i < layout.panes; i++) {
            const host = document.createElement('div')
            host.className = 'terminal-host'
            host.style.cssText = 'min-width:0;min-height:0;overflow:hidden'
            container.append(host)
            window.peers.push(window.createRuntime(host, 'webgl'))
          }
          const host = document.createElement('div')
          host.className = 'terminal-host'
          // An offscreen reference pauses xterm's resize service; opacity keeps it in the observed viewport.
          host.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none'
          document.body.append(host)
          window.reference = window.createRuntime(host, 'dom')
          await window.settle()
        }, layout)
        await page.waitForFunction(() =>
          window.peers.every(({ runtime }) => Boolean(runtime.terminal._core._renderService._renderer.value._gl))
        )
        for (const [fontIndex, font] of fonts.entries())
          for (const [sizeIndex, size] of sizes.entries()) {
            const weight = [400, 500, 700][(fontIndex + sizeIndex) % 3]
            const theme = { background: '#ffffff', foreground: '#202020' }
            const sample = await page.evaluate(windowCheck, { font, size, weight, theme })
            const entry = { layout: layout.name, font, size, weight, theme: 'light', ...sample }
            result.cases.push(entry)
            if (sample.issues.length && result.cases.filter((sample) => sample.issues.length).length <= 10)
              await page.screenshot({ path: join(archive, `failure-${dpr}-${layout.name}-${fontIndex}-${size}.png`) })
          }
        // Reuse the same renderers through resize, hidden restoration, extreme sizes and theme changes.
        for (const [step, config] of [
          {
            width: layout.width * 0.73,
            height: layout.height * 0.61,
            font: fonts[0],
            size: 14,
            weight: 500,
            theme: { background: '#111111', foreground: '#dddddd' },
            lineHeight: 1.2
          },
          {
            width: layout.width,
            height: layout.height,
            font: fonts[1],
            size: 24,
            weight: 400,
            theme: { background: 'rgba(240,240,240,0.4)', foreground: '#202020' },
            hidden: true
          },
          {
            width: layout.width,
            height: layout.height,
            font: fonts[3],
            size: 6,
            weight: 700,
            theme: { background: '#ffffff', foreground: '#202020' },
            lineHeight: 1
          },
          {
            width: layout.width,
            height: layout.height,
            font: fonts[1],
            size: 48,
            weight: 500,
            theme: { background: '#ffffff', foreground: '#202020' },
            lineHeight: 1.5
          }
        ].entries()) {
          await page.evaluate(async (config) => {
            const container = document.getElementById('layout')
            if (config.hidden) {
              container.style.display = 'none'
              await window.settle()
              container.style.display = 'grid'
            }
            container.style.width = config.width + 'px'
            container.style.height = config.height + 'px'
            await window.settle()
          }, config)
          const sample = await page.evaluate(windowCheck, config)
          result.transitions.push({ layout: layout.name, step, ...config, ...sample })
          if ((dpr === 1.2 || dpr === 2) && step === 0)
            await page.screenshot({ path: join(archive, `layout-${dpr}-${layout.name}.png`) })
        }
        save()
        const proof = await page.evaluate(() => window.repackProof)
        if (proof)
          for (const phase of ['before', 'after'])
            writeFileSync(
              join(archive, `repack-${dpr}-${phase}.png`),
              Buffer.from(proof[phase].split(',')[1], 'base64')
            )
        console.log(
          JSON.stringify({
            dpr,
            layout: layout.name,
            cases: result.cases.length,
            failures: [...result.cases, ...result.transitions].filter((sample) => sample.issues.length).length
          })
        )
      }
      await page.evaluate(() => window.disposeLayout())
      assert.deepEqual(pageErrors, [])
    } finally {
      await browser.close()
      save()
    }
  }
  const samples = results.flatMap((result) => [...result.cases, ...result.transitions])
  const failures = samples.filter((sample) => sample.issues.length)
  const summary = {
    dprs,
    fonts,
    sizes,
    cases: samples.length,
    paneProbes: samples.reduce((sum, sample) => sum + sample.edges.length, 0),
    failures: failures.length,
    observations: samples.filter((sample) => sample.observations.length).length,
    archive
  }
  writeFileSync(join(archive, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(JSON.stringify(summary))
  assert.equal(failures.length, 0, JSON.stringify(failures.slice(0, 3)))
} finally {
  rmSync(temporary, { recursive: true, force: true })
}

function windowCheck(config) {
  return window.check(config)
}
