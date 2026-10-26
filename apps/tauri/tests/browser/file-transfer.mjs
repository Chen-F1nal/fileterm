/* global window, document, getComputedStyle */
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
const directory = realpathSync(mkdtempSync(join(tmpdir(), 'fileterm-transfer-ui-')))
const root = fileURLToPath(new URL('../../../../', import.meta.url))
writeFileSync(
  join(directory, 'index.html'),
  '<html><head><style>html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>'
)
writeFileSync(
  join(directory, 'fixture.tsx'),
  `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ConfirmActionDialog} from '${root}apps/tauri/src/renderer/components/common/confirm-action-dialog/confirm-action-dialog.tsx';
import {FileTransferWorkspace} from '${root}apps/tauri/src/renderer/features/file-transfer/file-transfer-workspace.tsx';
import {applyThemeVariables} from '${root}apps/tauri/src/renderer/app/theme-config.ts';
import '${root}apps/tauri/src/renderer/styles/index.css';
applyThemeVariables('fileterm-dark');
window.setTheme=applyThemeVariables;
window.fileterm={platform:'browser'};
window.calls=[];
const file={path:'/srv/config.json',name:'config.json',type:'file',size:'128 B',modified:'2026-10-25 12:00',permission:'-rw-r--r--'};
const folder={path:'/srv/data',name:'data',type:'folder',size:'',modified:'2026-10-25 12:00'};
const api={platform:'browser',
createRemoteDirectory:async(...args)=>window.calls.push(['mkdir',...args]),
createRemoteFile:async(...args)=>window.calls.push(['create',...args]),
renameRemotePath:async(...args)=>{window.calls.push(['rename',...args]);if(window.holdNextRename){window.holdNextRename=false;await new Promise(resolve=>window.releaseRename=resolve)}},
deleteRemotePath:async(...args)=>window.calls.push(['delete',...args]),
copyRemotePath:async(...args)=>window.calls.push(['duplicate',...args]),
moveRemotePath:async(...args)=>window.calls.push(['move',...args]),
changeRemotePermissions:async(...args)=>{window.calls.push(['permissions',...args]);if(window.holdNextPermissions){window.holdNextPermissions=false;await new Promise(resolve=>window.releasePermissions=resolve)}},
writeClipboardText:async(...args)=>window.calls.push(['path',...args]),
openFileEditorWindow:async(...args)=>window.calls.push(['open',...args]),
updatePathBookmark:async(...args)=>window.calls.push(['bookmark',...args]),
selectLocalDirectory:async()=>'/chosen', selectLocalFiles:async()=>['/chosen/upload.txt'],
uploadFile:async(...args)=>window.calls.push(['upload',...args]),downloadRemotePath:async(...args)=>window.calls.push(['download',...args]),listLocalDirectory:async()=>({path:'/local',items:[{...file,path:'/local/local.txt',name:'local.txt'}]}),browseTransferDirectory:async(tab,path)=>{window.calls.push(['browse',tab,path]);if(window.holdNextBrowse){window.holdNextBrowse=false;await new Promise(resolve=>window.releaseBrowse=resolve)}if(path==='/denied')throw new Error('Permission denied');if(path==='/many')return Array.from({length:100},(_,i)=>({...file,path:'/many/file-'+i,name:'file-'+i}));return path==='/srv'?[...(window.omitConfig?[]:[file]),folder]:[{...file,path:path+'/nested.json',name:'nested.json'}]},copyBetweenServers:async(...args)=>{window.calls.push(['copy',...args]);if(window.holdNextCopy){window.holdNextCopy=false;await new Promise(resolve=>window.releaseCopy=resolve)}return 'transfer-test'},onTransferUpdate:(callback)=>{window.transferUpdate=callback;return ()=>{}}};
const tabs=[{id:'a',profileId:'A',sessionType:'ssh',title:'Production'},{id:'b',profileId:'B',sessionType:'ftp',title:'Backup'}];
const sessions={a:{connected:true,remotePath:'/srv',fileAccessMode:'user'},b:{connected:true,remotePath:'/backup',fileAccessMode:'user'}};
const fixtureRoot=createRoot(document.getElementById('root'));
window.showQuitDialog=(busy=false)=>fixtureRoot.render(React.createElement(ConfirmActionDialog,{title:'退出确认',description:'确定要退出 FileTerm 吗？',confirmLabel:'直接退出',cancelLabel:'取消',isSubmitting:busy,onClose:()=>{},onConfirm:()=>{}}));
fixtureRoot.render(React.createElement(FileTransferWorkspace,{api,tabs,sessions,initialTabId:'a',initialPath:'/srv',isActive:true}));

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
        '.woff2': 'font/woff2',
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
let browser
try {
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await page.getByRole('button', { name: '右侧连接', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Backup · FTP', exact: true }).click()
  await page.getByText('config.json', { exact: true }).click()
  const copyButton = page.locator('.file-transfer-workspace__toolbar .ft-btn--primary')
  const policyButton = page.getByRole('button', { name: '同名文件处理', exact: true })
  const stableControls = () =>
    page.locator('.file-transfer-workspace__toolbar').evaluate((toolbar) => {
      const controls = [toolbar.querySelector('.ft-btn--primary'), toolbar.querySelector('.dropdown-select-trigger')]
      return controls.map((control) => ({
        width: control.getBoundingClientRect().width,
        height: control.getBoundingClientRect().height,
        className: control.className,
        opacity: getComputedStyle(control).opacity,
        color: getComputedStyle(control).color
      }))
    })
  const beforeRefresh = await stableControls()
  await page.evaluate(() => (window.holdNextBrowse = true))
  await page.locator('[data-transfer-pane="left"] .file-transfer-pane__refresh').click()
  await page.waitForFunction(() => typeof window.releaseBrowse === 'function')
  assert.equal(await copyButton.evaluate((button) => button.disabled), false)
  assert.equal(await copyButton.getAttribute('aria-disabled'), 'true')
  assert.equal(await policyButton.isDisabled(), false)
  assert.equal(await page.locator('[data-transfer-pane="left"] tr.is-selected').count(), 1)
  assert.equal(await page.locator('.file-transfer-workspace__toolbar .ft-btn--loading').count(), 0)
  assert.deepEqual(await stableControls(), beforeRefresh)
  const draftInput = page.locator('[data-transfer-pane="left"] .pane-path-bar input')
  const filterInput = page.locator('[data-transfer-pane="left"] .pane-filter-input')
  assert.equal(await draftInput.isDisabled(), false)
  assert.equal(await filterInput.isDisabled(), false)
  await draftInput.fill('/unsent-path')
  await filterInput.fill('con')
  await copyButton.dispatchEvent('click')
  assert.equal(await page.getByRole('dialog').count(), 0, 'refresh must still guard duplicate/invalid copy attempts')
  await page.evaluate(() => window.releaseBrowse())
  await page.waitForFunction(
    () =>
      document.querySelector('.file-transfer-workspace__toolbar .ft-btn--primary').getAttribute('aria-disabled') ===
      'false'
  )
  assert.deepEqual(await stableControls(), beforeRefresh)
  assert.equal(await page.locator('[data-transfer-pane="left"] tr.is-selected').count(), 1)
  assert.equal(await draftInput.inputValue(), '/unsent-path')
  assert.equal(await filterInput.inputValue(), 'con')
  await draftInput.fill('/srv')
  await filterInput.fill('')
  // Refreshing the other pane must not flip the copy direction or activate a different source.
  await page.locator('[data-transfer-pane="right"] .file-transfer-pane__refresh').click()
  await page.waitForFunction(
    () =>
      document.querySelector('[data-transfer-pane="right"] .file-transfer-pane__scroll').getAttribute('aria-busy') ===
      'false'
  )
  assert.equal(await page.locator('[data-transfer-pane="left"].is-active').count(), 1)
  const beforeSubmission = await copyButton.boundingBox()
  const panesBeforeSubmission = await page.locator('.file-transfer-workspace__panes').boundingBox()
  await page.getByRole('button', { name: '复制到右侧 →', exact: true }).click()
  assert.equal((await page.evaluate(() => window.calls.filter((c) => c[0] === 'copy'))).length, 0)
  const confirmCopy = page.getByRole('dialog').getByRole('button', { name: '复制', exact: true })
  const confirmBefore = await confirmCopy.boundingBox()
  await page.evaluate(() => (window.holdNextCopy = true))
  await confirmCopy.click()
  await page.waitForFunction(() => typeof window.releaseCopy === 'function')
  assert.deepEqual(await copyButton.boundingBox(), beforeSubmission)
  assert.deepEqual(await confirmCopy.boundingBox(), confirmBefore)
  assert.deepEqual(await page.locator('.file-transfer-workspace__panes').boundingBox(), panesBeforeSubmission)
  assert.equal(await confirmCopy.getAttribute('aria-busy'), 'true')
  await confirmCopy.dispatchEvent('click')
  assert.equal((await page.evaluate(() => window.calls.filter((c) => c[0] === 'copy'))).length, 1)
  await page.evaluate(() => window.releaseCopy())
  await page.getByText('已加入传输队列: 1', { exact: true }).waitFor()
  assert.deepEqual(await page.locator('.file-transfer-workspace__panes').boundingBox(), panesBeforeSubmission)
  assert.deepEqual(await page.evaluate(() => window.calls.find((c) => c[0] === 'copy')), [
    'copy',
    'a',
    'b',
    '/srv/config.json',
    '/backup',
    false
  ])
  await page.getByRole('button', { name: '同名文件处理', exact: true }).click()
  await page.getByRole('menuitem', { name: '同名覆盖', exact: true }).click()
  await page.getByText('nested.json', { exact: true }).click()
  await page.getByRole('button', { name: '← 复制到左侧', exact: true }).click()
  await page.getByText('将覆盖同名文件；目录合并复制，不删除目标中额外的文件。', { exact: true }).waitFor()
  await page.getByRole('button', { name: '复制', exact: true }).click()
  await page.waitForFunction(() => window.calls.filter((c) => c[0] === 'copy').length === 2)
  assert.deepEqual(await page.evaluate(() => window.calls.filter((c) => c[0] === 'copy')[1]), [
    'copy',
    'b',
    'a',
    '/backup/nested.json',
    '/srv',
    true
  ])
  const sourceBox = await page.getByText('config.json', { exact: true }).boundingBox()
  const targetBox = await page.locator('[data-transfer-pane="right"] .file-transfer-pane__scroll').boundingBox()
  await page.mouse.move(sourceBox.x + 10, sourceBox.y + 8)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + 80, targetBox.y + 100, { steps: 12 })
  await page.mouse.up()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  assert.equal((await page.evaluate(() => window.calls.filter((c) => c[0] === 'copy'))).length, 2)
  await page.locator('.file-transfer-workspace__toolbar p').click()
  assert.equal(await page.locator('.file-transfer-pane.is-active').count(), 0)
  assert.equal(await page.locator('.file-transfer-pane tr.is-selected').count(), 0)
  assert.equal(await page.locator('.file-transfer-workspace__toolbar .ft-btn--primary').isDisabled(), true)
  await page.getByText('config.json', { exact: true }).click()
  assert.equal(await page.locator('[data-transfer-pane="left"].is-active').count(), 1)
  await page.locator('.file-transfer-workspace__hint').click()
  assert.equal(await page.locator('.file-transfer-pane.is-active').count(), 0)
  const typography = await page.evaluate(() => {
    const root = document.querySelector('.file-transfer-workspace')
    const copy = root.querySelector('.ft-btn--primary')
    const select = root.querySelector('.dropdown-select-trigger')
    const refresh = root.querySelector('.file-transfer-pane__refresh')
    return {
      font: getComputedStyle(root).fontSize,
      buttonFont: getComputedStyle(copy).fontSize,
      buttonWeight: getComputedStyle(copy).fontWeight,
      heights: [copy, select, refresh].map((element) => element.getBoundingClientRect().height)
    }
  })
  assert.deepEqual(typography, { font: '12px', buttonFont: '11px', buttonWeight: '600', heights: [28, 28, 28] })
  if (process.env.FILETERM_UI_ARTIFACT_DIR)
    await page.screenshot({ path: join(process.env.FILETERM_UI_ARTIFACT_DIR, 'fileterm-transfer-dark.png') })
  console.log(
    'bounds',
    await page.locator('.file-transfer-workspace').evaluate((el) => ({
      width: el.clientWidth,
      scrollWidth: el.scrollWidth,
      height: el.clientHeight,
      scrollHeight: el.scrollHeight
    }))
  )
  await page.evaluate(() => window.setTheme('fileterm-light'))
  assert.equal(
    await page
      .locator('.dropdown-select-trigger')
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    'rgb(255, 255, 255)'
  )
  await page.setViewportSize({ width: 900, height: 650 })
  if (process.env.FILETERM_UI_ARTIFACT_DIR)
    await page.screenshot({ path: join(process.env.FILETERM_UI_ARTIFACT_DIR, 'fileterm-transfer-light.png') })
  assert.equal(await page.locator('.file-transfer-workspace').evaluate((el) => el.scrollWidth > el.clientWidth), false)

  await page.getByText('config.json', { exact: true }).click()
  await page.locator('[data-transfer-pane="right"] input[aria-label]').first().fill('/denied')
  await page.locator('[data-transfer-pane="right"] input[aria-label]').first().press('Enter')
  await page.getByText('Error: Permission denied', { exact: true }).waitFor()
  const failedHeader = page.locator('[data-transfer-pane="right"] .file-transfer-pane__header')
  const failedHeaderBounds = await failedHeader.boundingBox()
  await page.evaluate(() => {
    window.holdNextBrowse = true
    window.releaseBrowse = null
  })
  await page.locator('[data-transfer-pane="right"] .file-transfer-pane__refresh').click()
  await page.waitForFunction(() => typeof window.releaseBrowse === 'function')
  assert.equal(await page.getByText('Error: Permission denied', { exact: true }).isVisible(), true)
  assert.deepEqual(await failedHeader.boundingBox(), failedHeaderBounds)
  await page.evaluate(() => window.releaseBrowse())
  await page.waitForFunction(
    () =>
      document.querySelector('[data-transfer-pane="right"] .file-transfer-pane__scroll').getAttribute('aria-busy') ===
      'false'
  )
  assert.deepEqual(await failedHeader.boundingBox(), failedHeaderBounds)

  await page.getByText('config.json', { exact: true }).click()
  assert.equal(await page.locator('.file-transfer-workspace__toolbar .ft-btn--primary').isDisabled(), true)
  const rightPath = page.locator('[data-transfer-pane="right"] .pane-path-bar input')
  await rightPath.fill('/many')
  await rightPath.press('Enter')
  await page.getByText('file-0', { exact: true }).waitFor()
  const scroll = page.locator('[data-transfer-pane="right"] .file-transfer-pane__scroll')
  await scroll.evaluate((element) => {
    element.scrollTop = 73.5
  })
  const seams = await page.evaluate(() => {
    const root = document.querySelector('.file-transfer-workspace')
    const panes = [...root.querySelectorAll('[data-transfer-pane]')].map((pane) => pane.getBoundingClientRect())
    const viewport = root
      .querySelector('[data-transfer-pane="right"] .file-transfer-pane__scroll')
      .getBoundingClientRect()
    const headerElement = root.querySelector('[data-transfer-pane="right"] thead')
    const header = headerElement.getBoundingClientRect()
    const filter = root.querySelector('[data-transfer-pane="right"] .pane-filter-bar').getBoundingClientRect()
    const before = getComputedStyle(root, '::before'),
      after = getComputedStyle(root, '::after')
    const edge = document.elementFromPoint(header.left + 6, header.top + 0.5)
    return {
      gap: panes[1].left - panes[0].right,
      left: panes[0].left - root.getBoundingClientRect().left,
      right: root.getBoundingClientRect().right - panes[1].right,
      frames: [before.width, after.width],
      top: header.top - filter.bottom,
      bottom: viewport.top - header.bottom,
      outsideScroll: !headerElement.closest('.file-transfer-pane__scroll'),
      edgeIsHeader: Boolean(edge?.closest('thead')),
      rowHeight: root.querySelector('[data-transfer-pane="right"] tbody tr[data-index]').getBoundingClientRect().height
    }
  })
  assert.equal(seams.gap, 8)
  assert.equal(seams.left, 24)
  assert.equal(seams.right, 24)
  assert.deepEqual(seams.frames, ['12px', '12px'])
  assert.ok(Math.abs(seams.top) < 0.5)
  assert.ok(Math.abs(seams.bottom) < 0.5)
  assert.equal(seams.outsideScroll, true)
  assert.equal(seams.edgeIsHeader, true)
  assert.equal(seams.rowHeight, 24)
  const resizer = page.locator('[data-transfer-pane="right"] .col-resizer').first()
  const resizeBox = await resizer.boundingBox()
  await page.mouse.move(resizeBox.x + 1, resizeBox.y + resizeBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(resizeBox.x + 1 + 40, resizeBox.y + resizeBox.height / 2)
  await page.mouse.up()
  assert.equal(
    await page
      .locator('[data-transfer-pane="right"] th')
      .first()
      .evaluate((th) => th.offsetWidth),
    300
  )
  // Fractional scrolling and horizontal overflow must not move or misalign the fixed header.
  for (const top of [0, 0.5, 24.5, 73.5, 777.5]) {
    await scroll.evaluate((element, offset) => {
      element.scrollTop = offset
      element.scrollLeft = 95
    }, top)
    await page.waitForFunction(() => {
      const pane = document.querySelector('[data-transfer-pane="right"]')
      return (
        pane.querySelector('.file-transfer-pane__header').scrollLeft ===
        pane.querySelector('.file-transfer-pane__scroll').scrollLeft
      )
    })
    const alignment = await page.locator('[data-transfer-pane="right"]').evaluate((pane) => {
      const header = pane.querySelector('thead').getBoundingClientRect()
      const viewport = pane.querySelector('.file-transfer-pane__scroll').getBoundingClientRect()
      const cells = [...pane.querySelectorAll('thead th')].map((th) => th.getBoundingClientRect())
      const row = [...pane.querySelectorAll('tbody tr[data-index] td')]
        .slice(0, cells.length)
        .map((td) => td.getBoundingClientRect())
      return { gap: viewport.top - header.bottom, columns: cells.map((cell, index) => cell.left - row[index].left) }
    })
    assert.ok(Math.abs(alignment.gap) < 0.5)
    assert.ok(alignment.columns.every((delta) => Math.abs(delta) < 0.5))
  }
  if (process.env.FILETERM_UI_ARTIFACT_DIR)
    await page.screenshot({ path: join(process.env.FILETERM_UI_ARTIFACT_DIR, 'fileterm-transfer-scroll.png') })
  await page.getByRole('button', { name: '左侧连接', exact: true }).click()
  await page.getByRole('menuitem', { name: '本地', exact: true }).click()
  await page.getByText('local.txt', { exact: true }).click()
  await page.getByRole('button', { name: '同名文件处理', exact: true }).click()
  await page.getByRole('menuitem', { name: '同名跳过', exact: true }).click()
  await page.getByRole('button', { name: '复制到右侧 →', exact: true }).click()
  await page.getByRole('button', { name: '复制', exact: true }).click()
  await page.waitForFunction(() => window.calls.some((call) => call[0] === 'upload'))
  assert.deepEqual(await page.evaluate(() => window.calls.find((call) => call[0] === 'upload')), [
    'upload',
    'b',
    '/local/local.txt',
    '/many',
    { conflictPolicy: 'skip' }
  ])
  await scroll.evaluate((element) => {
    element.scrollTop = 0
    element.scrollLeft = 0
  })
  await page.getByText('file-0', { exact: true }).click()
  await page.getByRole('button', { name: '← 复制到左侧', exact: true }).click()
  await page.getByRole('button', { name: '复制', exact: true }).click()
  await page.waitForFunction(() => window.calls.some((call) => call[0] === 'download'))
  assert.deepEqual(await page.evaluate(() => window.calls.find((call) => call[0] === 'download')), [
    'download',
    'b',
    '/many/file-0',
    'file',
    '/local',
    { conflictPolicy: 'skip' }
  ])
  await page.getByRole('button', { name: '左侧连接', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Production · SFTP', exact: true }).click()
  const config = page.getByText('config.json', { exact: true })
  await config.click({ button: 'right' })
  for (const label of [
    '刷新',
    '添加到收藏',
    '打开',
    '复制',
    '剪切',
    '粘贴',
    '复制路径',
    '下载',
    '上传...',
    '新建文件夹',
    '新建文件',
    '重命名',
    '删除',
    '快速删除 (rm命令)',
    '文件权限...'
  ]) {
    await page.getByRole('menuitem', { name: label, exact: true }).waitFor()
  }
  if (process.env.FILETERM_UI_ARTIFACT_DIR) {
    await page.screenshot({ path: join(process.env.FILETERM_UI_ARTIFACT_DIR, 'fileterm-transfer-menu-light.png') })
    await page.evaluate(() => window.setTheme('fileterm-dark'))
    await page.screenshot({ path: join(process.env.FILETERM_UI_ARTIFACT_DIR, 'fileterm-transfer-menu-dark.png') })
    await page.evaluate(() => window.setTheme('fileterm-light'))
  }
  await page.getByRole('menuitem', { name: '复制路径', exact: true }).click()
  await page.waitForFunction(() => window.calls.some((call) => call[0] === 'path'))
  assert.deepEqual(await page.evaluate(() => window.calls.find((call) => call[0] === 'path')), [
    'path',
    '/srv/config.json'
  ])
  await config.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '打开', exact: true }).click()
  await page.waitForFunction(() => window.calls.some((call) => call[0] === 'open'))
  assert.equal((await page.evaluate(() => window.calls.find((call) => call[0] === 'open')))[1].tabId, 'a')
  await config.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '添加到收藏', exact: true }).click()
  await page.waitForFunction(() => window.calls.some((call) => call[0] === 'bookmark'))
  assert.equal((await page.evaluate(() => window.calls.find((call) => call[0] === 'bookmark')))[1], 'remote:A')
  await config.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '重命名', exact: true }).click()
  await page.locator('.file-action-modal input').fill('renamed.json')
  const renameSubmit = page.locator('.file-action-modal').getByRole('button', { name: '确定', exact: true })
  const renameBounds = await renameSubmit.boundingBox()
  await page.evaluate(() => (window.holdNextRename = true))
  await renameSubmit.click()
  await page.waitForFunction(() => typeof window.releaseRename === 'function')
  assert.deepEqual(await renameSubmit.boundingBox(), renameBounds)
  assert.equal(await renameSubmit.getAttribute('aria-busy'), 'true')
  await page.evaluate(() => window.releaseRename())
  await page.waitForFunction(() => window.calls.some((call) => call[0] === 'rename'))
  assert.deepEqual(await page.evaluate(() => window.calls.find((call) => call[0] === 'rename')), [
    'rename',
    'a',
    '/srv/config.json',
    'renamed.json'
  ])
  await page.locator('.file-action-modal').waitFor({ state: 'hidden' })
  const blank = page.locator('[data-transfer-pane="left"] .file-transfer-pane__scroll')
  await blank.click({ button: 'right', position: { x: 80, y: 250 } })
  assert.equal(await page.getByRole('menuitem', { name: '删除', exact: true }).isDisabled(), true)
  await page.getByRole('menuitem', { name: '新建文件夹', exact: true }).click()
  await page.locator('.file-action-modal input').fill('new-folder')
  await page.locator('.file-action-modal').getByRole('button', { name: '确定', exact: true }).click()
  await page.waitForFunction(() => window.calls.some((call) => call[0] === 'mkdir'))
  assert.deepEqual(await page.evaluate(() => window.calls.find((call) => call[0] === 'mkdir')), [
    'mkdir',
    'a',
    '/srv',
    'new-folder'
  ])
  await page.locator('.file-action-modal').waitFor({ state: 'hidden' })
  await config.click()
  await page.getByText('data', { exact: true }).click({ modifiers: ['ControlOrMeta'] })
  await config.click({ button: 'right' })
  assert.equal(await page.getByRole('menuitem', { name: '重命名', exact: true }).isDisabled(), true)
  await page.getByRole('menuitem', { name: '删除', exact: true }).click()
  assert.equal((await page.evaluate(() => window.calls.filter((call) => call[0] === 'delete'))).length, 0)
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click()
  await config.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '删除', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click()
  await page.waitForFunction(() => window.calls.filter((call) => call[0] === 'delete').length === 2)
  assert.ok(
    (await page.evaluate(() => window.calls.filter((call) => call[0] === 'delete'))).every((call) => call[1] === 'a')
  )
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await config.click()
  await config.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '剪切', exact: true }).click()
  assert.equal(await page.locator('[data-transfer-pane="left"] tr.is-cut-pending').count(), 1)
  await page.locator('[data-transfer-pane="right"] tr[data-index]').first().click({ button: 'right' })
  assert.equal(await page.getByRole('menuitem', { name: '粘贴', exact: true }).isDisabled(), true)
  await page.keyboard.press('Escape')
  await config.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '复制', exact: true }).click()
  await blank.click({ button: 'right', position: { x: 80, y: 250 } })
  await page.getByRole('menuitem', { name: '粘贴', exact: true }).click()
  await page.waitForFunction(() => window.calls.some((call) => call[0] === 'duplicate'))
  assert.deepEqual(await page.evaluate(() => window.calls.find((call) => call[0] === 'duplicate')), [
    'duplicate',
    'a',
    '/srv/config.json',
    '/srv/config copy.json',
    'file'
  ])
  await config.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '文件权限...', exact: true }).click()
  await page.getByRole('textbox', { name: '权限值', exact: true }).fill('640')
  const permissionSubmit = page.getByRole('button', { name: '应用更改', exact: true })
  const permissionBounds = await permissionSubmit.boundingBox()
  await page.evaluate(() => (window.holdNextPermissions = true))
  await permissionSubmit.click()
  await page.waitForFunction(() => typeof window.releasePermissions === 'function')
  assert.deepEqual(await permissionSubmit.boundingBox(), permissionBounds)
  assert.equal(await permissionSubmit.getAttribute('aria-busy'), 'true')
  await page.evaluate(() => window.releasePermissions())
  await page.waitForFunction(() => window.calls.some((call) => call[0] === 'permissions'))
  assert.deepEqual((await page.evaluate(() => window.calls.find((call) => call[0] === 'permissions'))).slice(1, 3), [
    'a',
    '/srv/config.json'
  ])
  await page.locator('.file-permission-dialog').waitFor({ state: 'hidden' })
  await config.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '上传...', exact: true }).click()
  await page.waitForFunction(() => window.calls.some((call) => call[0] === 'upload' && call[1] === 'a'))
  assert.deepEqual(await page.evaluate(() => window.calls.find((call) => call[0] === 'upload' && call[1] === 'a')), [
    'upload',
    'a',
    '/chosen/upload.txt',
    '/srv',
    { conflictPolicy: 'skip' }
  ])
  await config.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '下载', exact: true }).click()
  await page.waitForFunction(() => window.calls.some((call) => call[0] === 'download' && call[1] === 'a'))
  assert.deepEqual(await page.evaluate(() => window.calls.find((call) => call[0] === 'download' && call[1] === 'a')), [
    'download',
    'a',
    '/srv/config.json',
    'file',
    '/chosen',
    { conflictPolicy: 'skip' }
  ])
  await config.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '重命名', exact: true }).click()
  await page.getByRole('dialog', { name: '重命名', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await page.locator('.file-action-modal').waitFor({ state: 'hidden' })
  await config.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '文件权限...', exact: true }).click()
  await page.locator('.file-permission-dialog').waitFor()
  await page.keyboard.press('Escape')
  await page.locator('.file-permission-dialog').waitFor({ state: 'hidden' })
  const browsesBeforeUnrelated = (await page.evaluate(() => window.calls.filter((c) => c[0] === 'browse'))).length
  await page.evaluate(() =>
    window.transferUpdate({
      status: 'done',
      direction: 'upload',
      tabId: 'unrelated',
      profileId: 'other',
      destinationPath: '/some/file'
    })
  )
  await page.waitForTimeout(40)
  assert.equal(
    (await page.evaluate(() => window.calls.filter((c) => c[0] === 'browse'))).length,
    browsesBeforeUnrelated
  )
  await page.evaluate(() => (window.omitConfig = true))
  await page.locator('[data-transfer-pane="left"] .file-transfer-pane__refresh').click()
  await config.waitFor({ state: 'hidden' })
  assert.equal(await page.locator('[data-transfer-pane="left"] tr.is-selected').count(), 0)
  assert.equal(await copyButton.isDisabled(), true, 'a file removed by refresh must not remain copyable')
  await page.setViewportSize({ width: 760, height: 650 })
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => window.setTheme('fileterm-light'))
  await page.evaluate(() => {
    window.holdNextBrowse = true
    window.releaseBrowse = null
  })
  await page.getByRole('button', { name: '右侧连接', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Backup · FTP', exact: true }).click()
  await page.waitForFunction(() => typeof window.releaseBrowse === 'function')
  assert.equal(await page.locator('[data-transfer-pane="right"] .pane-path-bar input').inputValue(), '/backup')
  assert.equal(await page.locator('[data-transfer-pane="right"] tr[data-index]').count(), 0)
  await page.evaluate(() => window.releaseBrowse())
  await page.waitForFunction(
    () =>
      document.querySelector('[data-transfer-pane="right"] .file-transfer-pane__scroll').getAttribute('aria-busy') ===
      'false'
  )
  await page.getByText('config.json', { exact: true }).click()
  const narrowPanes = await page.locator('.file-transfer-workspace__panes').boundingBox()
  await page.getByRole('button', { name: '复制到右侧 →', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '复制', exact: true }).click()
  await page.getByText('已加入传输队列: 1', { exact: true }).waitFor()
  assert.deepEqual(await page.locator('.file-transfer-workspace__panes').boundingBox(), narrowPanes)
  await page.setViewportSize({ width: 1280, height: 800 })
  for (const theme of ['fileterm-dark', 'fileterm-light']) {
    await page.evaluate((value) => {
      window.setTheme(value)
      window.showQuitDialog()
    }, theme)
    const quit = page.getByRole('dialog').getByRole('button', { name: '直接退出', exact: true })
    await quit.waitFor()
    await page.evaluate(() => document.fonts.ready)
    const idle = await quit.boundingBox()
    const cancel = await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).boundingBox()
    assert.equal(idle.width, cancel.width, 'short quit and cancel labels must retain the same standard width')
    const naturalWidth = await quit.evaluate((button) => {
      const clone = button.cloneNode(true)
      clone.classList.remove('ft-btn--reserve-loading')
      button.parentElement.append(clone)
      const width = clone.getBoundingClientRect().width
      clone.remove()
      return width
    })
    assert.equal(idle.width, naturalWidth, 'loading support must not add idle padding')
    await page.evaluate(() => window.showQuitDialog(true))
    await page.waitForFunction(() => document.querySelector('.confirm-action-dialog__button--danger').disabled)
    assert.deepEqual(await quit.boundingBox(), idle)
    const spinner = await quit.locator('.ft-btn__spinner').boundingBox()
    assert.ok(Math.abs(spinner.x + spinner.width / 2 - (idle.x + idle.width / 2)) < 1)
    await page.evaluate(() => window.showQuitDialog(false))
    await page.waitForFunction(() => !document.querySelector('.confirm-action-dialog__button--danger').disabled)
    assert.deepEqual(await quit.boundingBox(), idle)
  }
  assert.deepEqual(errors, [])
  console.log(
    'File transfer browser checks passed: host selection, both directions, overwrite confirmation, canceled drag, themes, narrow layout, invalid destination, frame gutters, fixed header, resized columns, fractional scrolling, full context menus, scoped file actions, permissions, delete confirmation and clipboard safety and stable refresh controls, submission geometry, error retry and dialog keyboard behavior.'
  )
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  rmSync(directory, { recursive: true, force: true })
}
