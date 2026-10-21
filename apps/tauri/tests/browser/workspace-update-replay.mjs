/* global window, document */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const root = fileURLToPath(new URL('../../../../', import.meta.url)).replaceAll('\\', '/')
const baseline = process.env.FILETERM_PERF_BASELINE === '1'
const directory = mkdtempSync(join(tmpdir(), 'fileterm-update-replay-'))
let server, browser
try {
  await build({
    stdin: {
      resolveDir: root,
      loader: 'tsx',
      contents: `
import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { useAppShellState } from './apps/tauri/src/renderer/hooks/use-app-shell-state'
import { emptyState } from './apps/tauri/src/renderer/app/app-data'
import { getRendererWorkSnapshot, resetRendererWork } from './apps/tauri/src/renderer/lib/renderer-work-log'
const noop=()=>{}
const listeners=new Map()
const subscribe=(name,callback)=>{listeners.set(name,callback);return ()=>listeners.delete(name)}
const monitoring={generation:1,revision:1,phase:'healthy',attempt:0,maxAttempts:5,intervalSeconds:1}
const snapshot={...emptyState,activeTabId:'tab',sessions:{tab:{profileId:'p',connected:true,remotePath:'/',remoteFiles:[],monitoring,capabilities:{resourceMonitoring:true}}}}
window.fileterm=new Proxy({platform:'win32',getSnapshot:async()=>snapshot,getUiPreferences:async()=>({terminalZoomLocked:false}),getUiStateItem:async()=>null,setUiStateItem:async()=>{},setUiPreferences:async()=>{},getSecuritySettings:async()=>({lockEnabled:false,idleLockMinutes:0}),listImportedFonts:async()=>[],listLocalDirectory:async()=>({path:'/',items:[]}),isCurrentWindowMaximized:async()=>false,writeDiagnosticLog:async()=>{},onWorkspaceSnapshot:async callback=>subscribe('snapshot',callback),onTransferUpdate:callback=>subscribe('transfer',callback),onSessionMetrics:callback=>subscribe('metrics',callback)}, {get:(target,key)=>key in target?target[key]:String(key).startsWith('on')?()=>noop:undefined})
let release
const gate=new Promise(resolve=>release=resolve)
window.hold=true
function Fixture(){
 const shell=useAppShellState({searchParams:new URLSearchParams(),initialUiPreferences:{},desktopApi:window.fileterm,isConnectionFormWindow:false,isMainWorkspaceWindow:true,isConnectionManagerWindow:false,rendererPlatform:'win32'})
 window.current=shell.workspace
 if(window.hold&&shell.workspace.transfers.length)throw gate
 return <output>{shell.workspace.sessions.tab?.monitoring?.revision}</output>
}
createRoot(document.getElementById('root')).render(<Suspense fallback="pending"><Fixture/></Suspense>)
window.ready=()=>listeners.has('metrics')&&window.current?.sessions.tab
window.run=async()=>{
 resetRendererWork()
 listeners.get('transfer')({id:'transfer',direction:'upload',name:'test',status:'running',progress:1,resumable:true})
 for(let index=0;index<300;index++){
  listeners.get('metrics')({tabId:'tab',monitoring:{...monitoring,revision:index+2}})
  await new Promise(resolve=>setTimeout(resolve,2))
 }
 const pending=getRendererWorkSnapshot()
 window.hold=false;release()
 await new Promise(resolve=>setTimeout(resolve,100))
 listeners.get('snapshot')({...snapshot,workspaceRevision:1,transfers:window.current.transfers})
 await new Promise(resolve=>setTimeout(resolve,30))
 return {pending,final:getRendererWorkSnapshot(),revision:window.current.sessions.tab.monitoring.revision,transfers:window.current.transfers.length}
}
`
    },
    bundle: true,
    jsx: 'automatic',
    outfile: join(directory, 'bundle.js'),
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false' },
    plugins: baseline
      ? [
          {
            name: 'baseline',
            setup(builder) {
              builder.onLoad({ filter: /use-workspace-ipc-sync\.ts$/ }, (args) => ({
                contents: execFileSync(
                  'git',
                  [
                    'show',
                    `${process.env.FILETERM_PERF_BASELINE_REF || 'HEAD'}:apps/tauri/src/renderer/hooks/use-workspace-ipc-sync.ts`
                  ],
                  { cwd: root, encoding: 'utf8' }
                ),
                loader: 'ts',
                resolveDir: args.path.replace(/[/\\][^/\\]+$/, '')
              }))
            }
          }
        ]
      : [],
    loader: { '.ttf': 'dataurl', '.woff2': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl' },
    logLevel: 'silent'
  })
  server = createServer((request, response) =>
    response.end(
      request.url === '/bundle.js'
        ? readFileSync(join(directory, 'bundle.js'))
        : '<div id="root"></div><script src="/bundle.js"></script>'
    )
  )
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
    console.error(error.message)
  })
  await page.goto('http://127.0.0.1:' + server.address().port)
  await page
    .waitForFunction(() => window.ready?.())
    .catch(async (error) => {
      console.error(await page.evaluate(() => ({ body: document.body.innerText, ready: typeof window.ready })))
      throw error
    })
  const result = await page.evaluate(() => window.run())
  console.log(JSON.stringify({ baseline, ...result }))
  assert.deepEqual(errors, [])
  assert.equal(result.revision, 301, 'interleaved snapshots must not discard newer monitoring')
  assert.equal(result.transfers, 1, 'the pending transfer must survive monitoring updates')
  const calls = result.final.phases['session-metrics'].calls
  if (baseline) assert.ok(calls > 3000, 'control must reproduce updater replay amplification')
  else assert.equal(calls, 300, 'each IPC business update must run exactly once despite suspended rendering')
} finally {
  await browser?.close()
  if (server) await new Promise((resolve) => server.close(resolve))
  rmSync(directory, { recursive: true, force: true })
}
