/* global window, document, CompositionEvent */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

const require = createRequire(import.meta.url)
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const root = fileURLToPath(new URL('../../../../', import.meta.url)).replaceAll('\\', '/')
const renderer = process.env.FILETERM_SOAK_RENDERER || 'dom'
assert.ok(['dom', 'webgl'].includes(renderer), 'FILETERM_SOAK_RENDERER must be dom or webgl')
const directory = realpathSync(mkdtempSync(join(tmpdir(), 'fileterm-monitoring-depth-')))
const baseline = process.env.FILETERM_PERF_BASELINE === '1'
const baselineFiles = ['system-network-panel.tsx', 'system-sidebar.tsx', 'network-history.ts'].map(
  (name) => 'apps/tauri/src/renderer/features/system/' + name
)
writeFileSync(
  join(directory, 'index.html'),
  '<link rel="icon" href="data:,"><div id="root"></div><script type="module" src="/fixture.tsx"></script>'
)
writeFileSync(
  join(directory, 'fixture.tsx'),
  `
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Terminal } from '${root}node_modules/@xterm/xterm'
import { TerminalView } from '${root}apps/tauri/src/renderer/components/terminal-view'
import { setTerminalRendererPreference } from '${root}apps/tauri/src/renderer/app/terminal-renderer-preference'
import { SystemSidebar } from '${root}apps/tauri/src/renderer/features/system/system-sidebar'
import { createTerminalOutputDelivery, getTerminalOutputProgress } from '${root}apps/tauri/src/bridge/events/terminal-output'
const noop = () => {}
setTerminalRendererPreference(${JSON.stringify(renderer)})
const listeners = new Set()
window.writes = []; window.sent = 0; window.acked = 0; window.networkRenders = 0
window.fileterm = new Proxy({
 platform: 'win32', getUiPreferences: async () => ({terminalZoomLocked:false}),
 getUiStateItem: async () => null, setUiStateItem: async () => {},
 onTerminalData: listener => {listeners.add(listener); return () => listeners.delete(listener)},
 resizeTerminal: async () => {}, writeTerminal: async (_tab, data) => window.writes.push(data),
 writeDiagnosticLog: noop
}, {get(target, key) {if(key in target)return target[key]; if(String(key).startsWith('on'))return () => noop}})
const open = Terminal.prototype.open
Terminal.prototype.open = function(...args) {window.terminal = this; return open.apply(this, args)}
const metrics = {cpuPercent:8, memoryPercent:10, networkInterfaces:['all','eth0'], activeNetworkInterface:'all', networkSamples:[], fileSystemRows:[]}
const delivery = createTerminalOutputDelivery(listeners, async () => {window.acked++}, noop)
window.progress = getTerminalOutputProgress
const appRoot = createRoot(document.getElementById('root'))
window.unmount = () => appRoot.unmount()
window.subscriptionCount = () => listeners.size
function Fixture() {
 const [current, setCurrent] = useState(metrics)
 const [active, setActive] = useState(true)
 window.setActive = value => flushSync(() => setActive(value))
 window.updateMetrics = next => flushSync(() => setCurrent({...metrics, ...next}))
 // Model a backlog of discrete commits before normal-priority effect work can drain.
 // flushSync is test-only; the production IPC and xterm input handlers stay unchanged.
 window.burst = (kind, count) => {
  for(let index=0; index<count; index++) {
   const sample = {rx:kind==='live' ? index+1 : 4, tx:8, sampledAt:kind==='live' ? index+1 : 1}
   window.updateMetrics({cpuPercent:index%100, networkSamples:kind==='empty' ? [] : [sample], fileSystemRows:[]})
   window.terminal.input('x', true)
  }
 }
 window.output = async count => {
  for(let index=0; index<count; index++) {
   while(window.sent-window.acked>=4)await new Promise(resolve=>setTimeout(resolve,0))
   delivery({tabId:'tab',deliveryId:window.sent++,chunk:'\\x1b[H\\x1b[2J▢ 中文 é ⚠️ tool '+index+' ──────────'})
  }
  while(window.sent!==window.acked)await new Promise(resolve=>setTimeout(resolve,0))
 }
 return <div style={{display:'flex', width:1000, height:600}}>
  <aside className="fs-sidebar" style={{width:214}}><SystemSidebar activeProfile={null} activeTabId="tab"
   activeSession={{profileId:'p',connected:true,capabilities:{resourceMonitoring:true},monitoring:{phase:'healthy',generation:1,revision:current.cpuPercent},systemMetrics:current}}
   collapsed={false} connectionStatus="connected" showResourceMeters visibleMetrics={['cpu','network']}
   onMonitoringSnapshot={noop} onOpenSystemInfo={noop} onToggleCollapsed={noop}/></aside>
  <div style={{flex:1,minWidth:0}}><TerminalView profileId="p" tabId="tab" sessionType="ssh" isActive={active} connected bootText=""/></div>
 </div>
}
appRoot.render(<Fixture/>)
`
)
await build({
  configFile: false,
  root: directory,
  plugins: [
    {
      name: 'monitoring-baseline-and-render-count',
      enforce: 'pre',
      transform(code, id) {
        const relative = id.startsWith(root) ? id.slice(root.length) : ''
        if (baseline && baselineFiles.includes(relative)) {
          code = execFileSync('git', ['show', `${process.env.FILETERM_PERF_BASELINE_REF || 'HEAD'}:${relative}`], {
            cwd: root,
            encoding: 'utf8'
          })
        }
        if (relative === baselineFiles[0]) {
          return {
            code: code.replace(
              'function NetworkPanel({ metrics }: { metrics?: SystemMetrics }) {',
              'function NetworkPanel({ metrics }: { metrics?: SystemMetrics }) { window.networkRenders++;'
            ),
            map: null
          }
        }
        if (baseline && baselineFiles.includes(relative)) return { code, map: null }
      }
    },
    react()
  ],
  resolve: {
    alias: [
      { find: /^react$/, replacement: require.resolve('react') },
      { find: /^react\/jsx-runtime$/, replacement: require.resolve('react/jsx-runtime') },
      { find: /^react-dom$/, replacement: require.resolve('react-dom') },
      { find: /^react-dom\/client$/, replacement: require.resolve('react-dom/client') }
    ]
  },
  logLevel: 'error',
  build: { minify: false, outDir: join(directory, 'dist') }
})
const server = createServer((request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname
    const file = join(directory, 'dist', pathname === '/' ? 'index.html' : pathname)
    response.setHeader(
      'Content-Type',
      { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(file)] ||
        'application/octet-stream'
    )
    response.end(readFileSync(file))
  } catch {
    response.writeHead(404)
    response.end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const engine = process.env.PLAYWRIGHT_ENGINE === 'webkit' ? webkit : chromium
let browser
try {
  browser = await engine.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    args: renderer === 'webgl' ? ['--enable-gpu'] : []
  })
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.addStyleTag({
    content:
      '.terminal-view,.terminal-host,.terminal-inner{height:100%;min-height:0;position:relative}.terminal-view{overflow:hidden}.terminal-host{padding:0}'
  })
  await page.waitForFunction(() => window.subscriptionCount?.() === 1)
  await page.waitForFunction((expected) => {
    const terminal = window.terminal
    return expected === 'webgl'
      ? Boolean(terminal?._core._renderService._renderer.value._gl)
      : Boolean(terminal?.element.querySelector('.xterm-rows'))
  }, renderer)
  for (const kind of ['empty', 'same', 'live']) {
    await page.evaluate((kind) => window.burst(kind, 120), kind)
  }
  await page.waitForFunction(() => window.writes.length === 360)
  assert.deepEqual(await page.evaluate(() => window.writes), Array(360).fill('x'))

  const paths = () => page.locator('.network-path').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')))
  const before = await paths()
  await page.evaluate(() =>
    window.updateMetrics({
      networkSamples: [
        { rx: 1, tx: 3, sampledAt: 200 },
        { rx: 7, tx: 9, sampledAt: 201, breakBefore: true }
      ]
    })
  )
  assert.notDeepEqual(await paths(), before)
  for (const path of await paths()) assert.equal((path.match(/M /g) || []).length, 2, 'recovery gaps stay visible')
  const renders = await page.evaluate(() => window.networkRenders)
  await page.waitForTimeout(150)
  assert.equal(await page.evaluate(() => window.networkRenders), renders, 'animation frames must not render React')
  await page.waitForFunction(
    () => document.querySelector('.network-chart-svg g').getAttribute('transform') !== 'translate(0 0)'
  )
  await page.waitForTimeout(400)
  assert.equal(await page.locator('.network-chart-svg g').getAttribute('transform'), `translate(${-100 / 63} 0)`)

  const defaultInterface = await page.locator('.network-select .dropdown-select-value').textContent()
  await page.locator('.network-select').click()
  await page.getByRole('menuitem', { name: 'eth0', exact: true }).click()
  await page.evaluate(() => window.updateMetrics({ networkSamples: [] }))
  assert.equal(await page.locator('.network-select .dropdown-select-value').textContent(), 'eth0')
  await page.evaluate(() => window.updateMetrics({ networkInterfaces: ['all'] }))
  await page.waitForFunction(
    (label) => window.document.querySelector('.network-select .dropdown-select-value').textContent === label,
    defaultInterface
  )

  await page.locator('.terminal-inner').click({ button: 'right', position: { x: 100, y: 80 } })
  await page.locator('.terminal-context-menu').waitFor()
  const queryCursor = () => page.evaluate(() => new Promise((resolve) => window.terminal.write('\x1b[6n', resolve)))
  const assertCursorReply = async () => {
    const reply = await page.evaluate(() => window.writes.at(-1))
    assert.equal(reply.charCodeAt(0), 27)
    assert.match(reply.slice(1), /^\[\d+;\d+R$/)
  }
  const beforeQuery = await page.evaluate(() => window.writes.length)
  await queryCursor()
  await page.waitForFunction((count) => window.writes.length === count + 1, beforeQuery)
  await assertCursorReply()
  assert.equal(await page.locator('.terminal-context-menu').count(), 1, 'query replies must not close UI menus')
  await page.keyboard.type('a')
  await page.locator('.terminal-context-menu').waitFor({ state: 'detached' })
  await page.waitForFunction(() => window.writes.at(-1) === 'a')
  await page.evaluate(() => {
    window.setActive(false)
    window.terminal.input('inactive-user-input', true)
    window.terminal.textarea.dispatchEvent(new CompositionEvent('compositionstart'))
  })
  const beforeBackgroundQuery = await page.evaluate(() => window.writes.length)
  await queryCursor()
  await page.waitForFunction((count) => window.writes.length === count + 1, beforeBackgroundQuery)
  await assertCursorReply()
  assert.equal(await page.evaluate(() => window.writes.includes('inactive-user-input')), false)
  await page.evaluate(() => {
    window.terminal.textarea.dispatchEvent(new CompositionEvent('compositionend', { data: '' }))
    window.setActive(true)
  })
  await page.evaluate(() => window.output(200))
  const progress = await page.evaluate(() => window.progress())
  assert.equal(progress.receivedBatches, 200)
  assert.equal(progress.acknowledgedBatches, 200)
  assert.equal(progress.pendingBatches, 0)
  assert.equal(progress.pendingAcknowledgements, 0)
  assert.equal(progress.parseFailures, 0)
  assert.equal(
    await page.evaluate(() =>
      window.terminal._core._renderService._renderer.value._gl
        ? 'webgl'
        : window.terminal.element.querySelector('.xterm-rows')
          ? 'dom'
          : 'unknown'
    ),
    renderer,
    'the selected renderer remains active through the regression'
  )
  await page.evaluate(() => {
    window.updateMetrics({ networkSamples: [{ rx: 12, tx: 18, sampledAt: 300 }] })
    window.unmount()
  })
  assert.equal(await page.evaluate(() => window.subscriptionCount()), 0)
  await page.waitForTimeout(100)
  assert.deepEqual(errors, [])
  console.log(
    `PASS (${renderer}): production React, 360 monitoring/input commits, SVG animation without React renders, query replies preserve menus and survive background/composition, 200 parsed/ACKed batches, clean unmount`
  )
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  rmSync(directory, { recursive: true, force: true })
}
