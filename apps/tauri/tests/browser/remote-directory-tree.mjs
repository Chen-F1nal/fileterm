/* global window, document */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const directory = realpathSync(mkdtempSync(join(tmpdir(), 'fileterm-directory-tree-')))
const root = fileURLToPath(new URL('../../../../', import.meta.url))
writeFileSync(
  join(directory, 'index.html'),
  '<html data-theme="fileterm-dark"><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>'
)
writeFileSync(
  join(directory, 'fixture.tsx'),
  `
import React, { useState } from 'react'
import { createCodexThemeConfig, createDefaultThemeConfig, normalizeThemeConfig } from '${root}packages/core/src/index'
import { createRoot } from 'react-dom/client'
import { FileManager } from '${root}apps/tauri/src/renderer/features/files/file-manager'
import { applyThemeVariables, deriveThemeVariant, getThemeConfigFromTokenPreset } from '${root}apps/tauri/src/renderer/app/theme-config'
import '${root}apps/tauri/src/renderer/styles/index.css'
window.fixtureTheme = (mode) => {
 const variant = mode.endsWith('light') ? 'light' : 'dark'
 const config = mode.startsWith('iterm2-') ? getThemeConfigFromTokenPreset(mode.replace(/-(dark|light)$/,''),variant) : mode.startsWith('codex') ? createCodexThemeConfig(variant) : undefined
 applyThemeVariables(mode.startsWith('iterm2-') ? 'fileterm-'+variant : mode,config)
}
window.fixtureLegacyTheme = () => {
 const legacy = createDefaultThemeConfig('dark')
 legacy.codeThemeId = 'custom'
 delete legacy.theme.surfaceSidebar
 delete legacy.theme.surfaceInput
 delete legacy.theme.surfaceContextMenu
 legacy.theme.surfaceElevated = '#2e2e2e'
 legacy.theme.overrides = {'--ref-preview-dark-content':'#2a2a2a'}
 const normalized = normalizeThemeConfig(legacy)
 const light = deriveThemeVariant(normalized,'light')
 return {surface:normalized.theme.surfaceElevated,override:normalized.theme.overrides['--ref-preview-dark-content'],variant:light.variant,hasSidebar:Object.hasOwn(light.theme,'surfaceSidebar')}
}
window.fixtureSurfaceColors = (mode) => {
 const config = mode.startsWith('codex') ? createCodexThemeConfig(mode.endsWith('light') ? 'light' : 'dark') : createDefaultThemeConfig(mode.endsWith('light') ? 'light' : 'dark')
 config.codeThemeId = 'custom'
 Object.assign(config.theme, {surfaceSidebar:'#123456',surfaceInput:'#234567',surfaceContextMenu:'#345678',surfaceElevated:'#2a2a2a'})
 applyThemeVariables(mode, normalizeThemeConfig(config))
}
applyThemeVariables('fileterm-dark')
const folder = (path) => ({path,name:path.split('/').at(-1)||'/',type:'folder',size:'-',modified:''})
const file = (path) => ({...folder(path),type:'file',size:'1 KB'})
const catalog = {
  '/':[folder('/etc'),folder('/home'),folder('/restricted')],
  '/home':[folder('/home/user')], '/home/user':[folder('/home/user/logs'),file('/home/user/note.txt')],
  '/home/user/logs':[], '/etc':[folder('/etc/ssh')], '/etc/ssh':[], '/restricted':[]
}
window.fixtureRequests = []
window.fixtureFailRestricted = true
window.fileterm = new Proxy({
  platform: new URLSearchParams(location.search).get('platform') || 'darwin',
  getUiStateItem: async (key) => sessionStorage.getItem(key),
  setUiStateItem: async (key,value) => sessionStorage.setItem(key,value),
  listRemoteDirectory: async (_tab,path) => {
    window.fixtureRequests.push(path)
    if(path==='/restricted' && window.fixtureFailRestricted) throw new Error('Permission denied')
    return catalog[path] || []
  }
}, {get:(target,key) => target[key] ?? (String(key).startsWith('on') ? () => () => {} : async () => [])})
function Fixture() {
  const [session,setSession] = useState({profileId:'preview',connected:true,remotePath:'/home/user',remoteFiles:catalog['/home/user'],capabilities:{files:true,tunnels:false}})
  const [access,setAccess] = useState('user')
  const navigate = (path) => setSession(current=>({...current,remotePath:path,remoteFiles:catalog[path]||[]}))
  window.fixtureNavigate = navigate
  window.fixtureConnect = (connected) => setSession(current=>({...current,connected}))
  window.fixtureAccess = setAccess
  const noop = () => {}
  return <main style={{height:480,margin:16,display:'grid',gridTemplateRows:'minmax(0,1fr)'}}><FileManager
    activeSession={session} activeTab={{id:'preview-tab',profileId:'preview',sessionType:'ssh'}} activeView="file"
    localPath="/Users/demo" localPanePath="/Users/demo" localItems={[folder('/Users/demo/Documents'),file('/Users/demo/local.txt')]}
    commandPaneWidth={240} sendTargets={[]} commandFolders={[]} commandTemplates={[]}
    isBusy={false} isLocalNetworkShare={false} isLocalDirectoryLoading={false} isWorkspaceRefreshing={false} isWorkspaceSwitching={false}
    canPasteToLocal={false} canPasteToRemote={false} clipboardStatusText={null} localCutPaths={[]} remoteCutPaths={[]}
    remoteFileAccessMode={access} isRemoteDirectoryLoading={false}
    onActiveViewChange={noop} onCommandPaneWidthChange={noop} onExecuteCommand={noop} onSendTerminalCommand={async()=>{}}
    onSaveTemporaryCommand={noop} onUpdateCommand={noop} onOpenCommandManager={noop} onCopyItems={noop} onCutItems={noop} onClearCutState={noop}
    onOpenLocalItem={noop} onOpenLocalPath={noop} onBackToLocalComputer={noop} onOpenRemoteItem={item=>navigate(item.path)} onOpenRemotePath={navigate}
    onPasteIntoPane={noop} onRefresh={()=>setSession(current=>({...current,remoteFiles:[...catalog[current.remotePath]]}))}
    onUploadFiles={noop} onChooseUploadFiles={noop} onDownloadFiles={noop} onDownloadLocalNetworkFiles={noop} onDropUpload={noop}
    onRequestChangePermissions={noop} onRequestDelete={noop} onRequestNewFile={noop} onRequestNewFolder={noop} onRequestQuickDelete={noop} onRequestRename={noop}
    onToggleFollowShellCwd={noop} onToggleRemoteFileAccessMode={noop}/></main>
}
createRoot(document.getElementById('root')).render(<Fixture/> )
`
)
await build({
  configFile: false,
  root: directory,
  base: './',
  plugins: [react()],
  logLevel: 'error',
  resolve: {
    alias: [
      { find: /^react$/, replacement: require.resolve('react') },
      { find: /^react\/jsx-runtime$/, replacement: require.resolve('react/jsx-runtime') },
      { find: /^react-dom\/client$/, replacement: require.resolve('react-dom/client') }
    ]
  },
  build: { minify: false, outDir: join(directory, 'dist') }
})
const server = createServer((request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname
    const data = readFileSync(join(directory, 'dist', path === '/' ? 'index.html' : path))
    const type =
      {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.ttf': 'font/ttf',
        '.svg': 'image/svg+xml'
      }[extname(path)] || 'application/octet-stream'
    response.writeHead(200, { 'Content-Type': path === '/' ? 'text/html' : type })
    response.end(data)
  } catch {
    response.writeHead(404)
    response.end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL })
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 530 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const address = `http://127.0.0.1:${server.address().port}`
  const mode = async (value) => {
    const native = page.locator('.file-pane-mode-select select')
    if (await native.count()) await native.selectOption(value)
    else {
      await page.locator('.file-pane-mode-select').click()
      await page
        .locator('.dropdown-select-menu button')
        .nth(value === 'local' ? 0 : 1)
        .click()
    }
  }
  const assertFlatTheme = async () => {
    const colors = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.className = 'system-sidebar-layout'
      probe.style.position = 'fixed'
      probe.style.left = '-10000px'
      probe.innerHTML =
        '<div class="process-row"></div><div class="process-row"></div><div class="disk-row"></div><div class="disk-row"></div><table class="system-table"><tbody><tr><td>a</td></tr><tr><td>b</td></tr></tbody></table>'
      document.body.append(probe)
      const rows = [...probe.querySelectorAll('.process-row,.disk-row,tr')].map(
        (node) => window.getComputedStyle(node).backgroundColor
      )
      probe.remove()
      const headers = [
        '.file-split .pane-path-bar',
        '.file-split .pane-filter-bar',
        '.remote-directory-tree-header',
        '.remote-pane th'
      ].map((selector) => window.getComputedStyle(document.querySelector(selector)).backgroundColor)
      return {
        rows,
        headers,
        panel: window.getComputedStyle(document.querySelector('.remote-directory-pane')).backgroundColor
      }
    })
    assert.ok(
      colors.rows.every((color) => color === colors.panel),
      JSON.stringify(colors)
    )
    assert.ok(
      colors.headers.every((color) => color === colors.headers[0]),
      JSON.stringify(colors)
    )
  }
  for (const platform of ['darwin', 'win32', 'linux']) {
    await page.goto(`${address}/?platform=${platform}`)
    await page.locator('.local-pane').waitFor()
    assert.deepEqual(await page.evaluate(() => window.fixtureLegacyTheme()), {
      surface: '#303030',
      override: '#303030',
      variant: 'light',
      hasSidebar: false
    })
    await page.locator('.file-pane-mode-select').click()
    await page.waitForTimeout(250)
    const controlMetrics = await page.evaluate(() => {
      const control = document.querySelector('.file-pane-mode-select')
      const rect = control.getBoundingClientRect()
      const toolbar = document.querySelector('.file-tabs').getBoundingClientRect()
      const user = document.querySelector('.file-tab-actions button[aria-pressed]').getBoundingClientRect()
      const style = window.getComputedStyle(control)
      return {
        height: rect.height,
        userHeight: user.height,
        top: rect.top,
        bottom: rect.bottom,
        toolbarTop: toolbar.top,
        toolbarBottom: toolbar.bottom,
        radius: style.borderRadius,
        borderTop: style.borderTopWidth,
        borderBottom: style.borderBottomWidth,
        background: style.backgroundColor
      }
    })
    assert.equal(controlMetrics.height, controlMetrics.userHeight)
    assert.ok(
      controlMetrics.top > controlMetrics.toolbarTop && controlMetrics.bottom < controlMetrics.toolbarBottom,
      JSON.stringify(controlMetrics)
    )
    assert.notEqual(controlMetrics.radius, '0px')
    assert.equal(controlMetrics.borderTop, '1px')
    assert.equal(controlMetrics.borderBottom, '1px')
    assert.equal(controlMetrics.background, 'rgb(26, 26, 26)')
    if (platform === 'darwin') await page.screenshot({ path: '/tmp/fileterm-mode-select-open.png' })
    await page.keyboard.press('Escape')
    await mode('remote-tree')
    await page.locator('[role="treeitem"][aria-label="user"]').waitFor()
    assert.equal(await page.locator('.local-pane').count(), 0)
    const activePath = () => page.locator('.file-split .pane-path-bar input').inputValue()
    assert.equal(await activePath(), '/home/user')
    const etc = page.locator('[role="treeitem"][aria-label="etc"]')
    await etc.locator('button').click()
    await page.locator('[role="treeitem"][aria-label="ssh"]').waitFor()
    assert.equal(await activePath(), '/home/user')
    await etc.locator('.remote-directory-name').click()
    await page.waitForFunction(() => document.querySelector('.file-split .pane-path-bar input')?.value === '/etc')
    assert.equal(await activePath(), '/etc')
    const restricted = page.locator('[role="treeitem"][aria-label="restricted"]')
    await restricted.locator('button').click()
    await page.locator('.remote-directory-error').waitFor()
    await page.evaluate(() => {
      window.fixtureFailRestricted = false
    })
    await page.locator('.remote-directory-error button').click()
    await page.locator('.remote-directory-error').waitFor({ state: 'hidden' })
    const rootRow = page.locator('[role="treeitem"][aria-label="/"]')
    await rootRow.locator('button').click()
    await page.locator('.remote-directory-locate').click()
    await etc.waitFor()
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'etc')
    await etc.press('ArrowRight')
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'ssh')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelector('.file-split .pane-path-bar input')?.value === '/etc/ssh')
    assert.equal(await activePath(), '/etc/ssh')
    await page.reload()
    await page.locator('[role="treeitem"][aria-label="user"]').waitFor()
    assert.equal(await page.locator('.local-pane').count(), 0)
    await page.evaluate(() => window.fixtureConnect(false))
    await page.locator('.remote-directory-unavailable').waitFor()
    await page.evaluate(() => window.fixtureConnect(true))
    await page.locator('[role="treeitem"][aria-label="user"]').waitFor()
    await page.evaluate(() => window.fixtureAccess('root'))
    await page.waitForFunction(() => window.fixtureRequests.filter((path) => path === '/').length >= 3)
    for (const theme of ['fileterm-dark', 'fileterm-light', 'codex-dark', 'codex-light']) {
      await page.evaluate((theme) => window.fixtureTheme(theme), theme)
      await page.waitForTimeout(250)
      const rowColors = await page
        .locator('.remote-pane tbody tr')
        .evaluateAll((rows) => rows.slice(0, 2).map((row) => window.getComputedStyle(row).backgroundColor))
      if (theme.startsWith('fileterm')) assert.notEqual(rowColors[0], rowColors[1])
      else {
        assert.equal(rowColors[0], rowColors[1])
        await assertFlatTheme()
        assert.equal(
          rowColors[0],
          await page.locator('.remote-directory-pane').evaluate((node) => window.getComputedStyle(node).backgroundColor)
        )
      }
      for (const width of [1100, 720]) {
        await page.setViewportSize({ width, height: 560 })
        const metrics = await page.evaluate(() => {
          const tree = document.querySelector('.remote-directory-row').getBoundingClientRect()
          const table = document
            .querySelector('.remote-pane tbody tr:not(.file-virtual-spacer)')
            .getBoundingClientRect()
          const header = document.querySelector('.file-remote-shared-header').getBoundingClientRect()
          const split = document.querySelector('.file-split').getBoundingClientRect()
          return {
            treeTop: tree.top,
            tableTop: table.top,
            treeHeight: tree.height,
            tableHeight: table.height,
            headerWidth: header.width,
            splitWidth: split.width
          }
        })
        assert.equal(metrics.treeHeight, 24)
        assert.equal(metrics.tableHeight, 24)
        assert.ok(Math.abs(metrics.treeTop - metrics.tableTop) <= 1, JSON.stringify(metrics))
        assert.equal(metrics.headerWidth, metrics.splitWidth)
      }
      await page.evaluate((theme) => window.fixtureSurfaceColors(theme), theme)
      await page.waitForTimeout(250)
      const colors = await page.evaluate(() => {
        const tokens = window.getComputedStyle(document.documentElement)
        return [
          '--ref-surface-sidebar',
          '--ref-surface-toolbar',
          '--ref-surface-input',
          '--ref-surface-context-menu',
          '--ref-surface-elevated'
        ].map((key) => tokens.getPropertyValue(key).trim())
      })
      assert.deepEqual(colors, ['#123456', '#123456', '#234567', '#345678', '#303030'])
      await page.locator('.file-pane-mode-select').click()
      await page.waitForTimeout(250)
      assert.equal(
        await page.locator('.dropdown-select-menu').evaluate((node) => window.getComputedStyle(node).backgroundColor),
        'rgb(52, 86, 120)'
      )
      await page.keyboard.press('Escape')
      await page.evaluate((theme) => window.fixtureTheme(theme), theme)
      await page.setViewportSize({ width: 1100, height: 560 })
      await page.waitForTimeout(250)
      if (platform === 'darwin') await page.screenshot({ path: `/tmp/fileterm-directory-tree-${theme}.png` })
    }
    if (platform === 'darwin') {
      for (const preset of ['dracula', 'nord', 'gruvbox', 'catppuccin', 'solarized', 'tokyonight']) {
        for (const variant of ['dark', 'light']) {
          await page.evaluate((mode) => window.fixtureTheme(mode), 'iterm2-' + preset + '-' + variant)
          await page.waitForTimeout(250)
          const rowColors = await page
            .locator('.remote-pane tbody tr')
            .evaluateAll((rows) => rows.slice(0, 2).map((row) => window.getComputedStyle(row).backgroundColor))
          assert.equal(rowColors[0], rowColors[1], preset + '-' + variant)
          await assertFlatTheme()
          assert.equal(
            rowColors[0],
            await page
              .locator('.remote-directory-pane')
              .evaluate((node) => window.getComputedStyle(node).backgroundColor)
          )
        }
      }
    }
    await page.evaluate(() => document.documentElement.style.setProperty('--folder-accent', 'rgb(160, 80, 210)'))
    assert.equal(
      await page
        .locator('.remote-directory-row > .app-icon')
        .first()
        .evaluate((node) => window.getComputedStyle(node).color),
      'rgb(160, 80, 210)'
    )
    await mode('local')
    await page.locator('.local-pane').waitFor()
  }
  assert.deepEqual(errors, [])
  console.log(
    'Passed: layout modes, lazy expansion, navigation, errors/retry, keyboard/locate, persistence, reconnect and access-mode isolation; macOS/Windows/Linux controls and dark/light themes.'
  )
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
  rmSync(directory, { recursive: true, force: true })
}
