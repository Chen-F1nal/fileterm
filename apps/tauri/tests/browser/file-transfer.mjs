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
import {FileTransferWorkspace} from '${root}apps/tauri/src/renderer/features/file-transfer/file-transfer-workspace.tsx';
import {applyThemeVariables} from '${root}apps/tauri/src/renderer/app/theme-config.ts';
import '${root}apps/tauri/src/renderer/styles/index.css';
applyThemeVariables('fileterm-dark');
window.setTheme=applyThemeVariables;
window.fileterm={platform:'browser'};
window.calls=[];
const file={path:'/srv/config.json',name:'config.json',type:'file',size:'128 B',modified:'2026-10-25 12:00',permission:'-rw-r--r--'};
const folder={path:'/srv/data',name:'data',type:'folder',size:'',modified:'2026-10-25 12:00'};
const api={platform:'browser',listLocalDirectory:async()=>({path:'/local',items:[{...file,path:'/local/local.txt',name:'local.txt'}]}),browseTransferDirectory:async(tab,path)=>{window.calls.push(['browse',tab,path]);if(path==='/denied')throw new Error('Permission denied');if(path==='/many')return Array.from({length:100},(_,i)=>({...file,path:'/many/file-'+i,name:'file-'+i}));return path==='/srv'?[file,folder]:[{...file,path:path+'/nested.json',name:'nested.json'}]},copyBetweenServers:async(...args)=>{window.calls.push(['copy',...args]);return 'transfer-test'},onTransferUpdate:()=>()=>{}};
const tabs=[{id:'a',profileId:'A',sessionType:'ssh',title:'Production'},{id:'b',profileId:'B',sessionType:'ftp',title:'Backup'}];
const sessions={a:{connected:true,remotePath:'/srv',fileAccessMode:'user'},b:{connected:true,remotePath:'/backup',fileAccessMode:'user'}};
createRoot(document.getElementById('root')).render(React.createElement(FileTransferWorkspace,{api,tabs,sessions,initialTabId:'a',initialPath:'/srv',isActive:true}));

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
  await page.getByRole('button', { name: '复制到右侧 →', exact: true }).click()
  assert.equal((await page.evaluate(() => window.calls.filter((c) => c[0] === 'copy'))).length, 0)
  await page.getByRole('button', { name: '复制', exact: true }).click()
  await page.getByText('已加入传输队列: 1', { exact: true }).waitFor()
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
  assert.deepEqual(errors, [])
  console.log(
    'File transfer browser checks passed: host selection, both directions, overwrite confirmation, canceled drag, themes, narrow layout, invalid destination, frame gutters, fixed header, resized columns and fractional scrolling.'
  )
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  rmSync(directory, { recursive: true, force: true })
}
