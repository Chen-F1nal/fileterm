/* global window, document, getComputedStyle */
import assert from 'node:assert/strict'
import { inspectFocusShadow } from './helpers/focus-shadow-clipping.mjs'
import postcss from 'postcss'
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
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const directory = realpathSync(mkdtempSync(join(tmpdir(), 'fileterm-button-ui-')))
const root = fileURLToPath(new URL('../../../../', import.meta.url))
writeFileSync(
  join(directory, 'index.html'),
  '<html><head><style>html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>'
)
const renderer = 'apps/tauri/src/renderer/'
const cssFiles = execFileSync('git', ['ls-files', `${renderer}*.css`], { cwd: root, encoding: 'utf8' })
  .trim()
  .split('\n')
function hoverRules(source) {
  const rules = []
  postcss.parse(source).walkRules((rule) => {
    for (const selector of rule.selectors.filter((s) => s.includes(':hover')))
      rules.push([
        selector.replace(/\s+/g, ' '),
        rule.nodes.filter((n) => n.type === 'decl').map((n) => [n.prop, n.value, n.important || false])
      ])
  })
  return rules
}
for (const file of cssFiles)
  assert.deepEqual(
    hoverRules(readFileSync(join(root, file), 'utf8')),
    hoverRules(execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' })),
    `hover must remain unchanged: ${file}`
  )
writeFileSync(
  join(directory, 'fixture.tsx'),
  `
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {Input,Textarea} from '${root}${renderer}components/common/input/input.tsx';
import {DropdownSelect} from '${root}${renderer}components/common/dropdown-select/dropdown-select.tsx';
import '${root}${renderer}features/files/file-manager-toolbar.css';
import '${root}${renderer}features/workspace/ssh-tunnel-panel.css';
import {ProxyManagerPage} from '${root}${renderer}features/proxies/proxy-manager-page.tsx';
import {SshTunnelPanel} from '${root}${renderer}features/workspace/ssh-tunnel-panel.tsx';
import {CommandCodeEditor} from '${root}${renderer}features/commands/command-code-editor.tsx';
import {applyThemeVariables} from '${root}${renderer}app/theme-config.ts';
import {createDefaultThemeConfig} from '${root}packages/core/src/index.ts';
import '${root}${renderer}styles/index.css';
const root=createRoot(document.getElementById('root'));const noop=()=>{};
window.renderFocus=(kind,theme,native=false)=>{
window.fileterm={platform:native?'darwin':'browser',listProxyProfiles:async()=>[],listTunnelProfiles:async()=>[]};
if(theme.startsWith('custom')){const config=createDefaultThemeConfig(theme.endsWith('light')?'light':'dark');config.theme.accent='#ff00ff';applyThemeVariables(theme.endsWith('light')?'fileterm-light':'fileterm-dark',config)}else applyThemeVariables(theme);
const input=<input id="field" aria-label="Field" defaultValue="value"/>;
const dropdown=<DropdownSelect ariaLabel="Field" className={kind==='toolbar'?'file-pane-mode-select':undefined} options={[{value:'a',label:'Local files'},{value:'b',label:'Remote files'}]} value="a" onChange={value=>window.chosen=value}/>;
let content;
if(kind==='input')content=<Input id="field" aria-label="Field" defaultValue="value"/>;
else if(kind==='error')content=<Input id="field" aria-label="Field" defaultValue="value" isError/>;
else if(kind==='disabled')content=<Input id="field" aria-label="Field" defaultValue="value" disabled/>;
else if(kind==='textarea')content=<Textarea id="field" aria-label="Field" defaultValue="value"/>;
else if(kind==='dropdown')content=dropdown;
else if(kind==='toolbar')content=<div className="file-manager"><div className="file-tabs"><div className="file-tab-actions">{dropdown}</div></div></div>;
else if(kind==='path')content=<div className="pane-path-bar"><span>远程</span><input id="field" aria-label="Field" defaultValue="/homes/Stoffel"/></div>;
else if(kind==='filter')content=<div className="pane-filter-input-wrapper"><input id="field" className="pane-filter-input" aria-label="Field" defaultValue="value"/></div>;
else if(kind==='command')content=<div className="command-editor-dialog-textarea"><CommandCodeEditor value="docker ps" onChange={noop} ariaLabel="Field"/></div>;
else if(kind==='proxy-manager')content=<div className="home-content-body suppress-home-entrance"><div className="page-transition"><ProxyManagerPage/></div></div>;
else if(kind==='runtime')content=<SshTunnelPanel tabId="test"/>;
else if(kind==='commandpreview')content=<div className="command-template-preview"><div className="command-editor-dialog-textarea"><CommandCodeEditor value="docker ps" onChange={noop} ariaLabel="Field"/></div></div>;
else if(kind==='terminal')content=<div className="terminal-dock-input-shell"><textarea id="field" aria-label="Field" defaultValue="pwd"/></div>;
else if(kind==='theme')content=<input id="field" className="theme-config-name-input" aria-label="Field" defaultValue="value"/>;
else if(kind==='checkbox')content=<input id="field" type="checkbox" className="selection-control" aria-label="Field"/>;
else if(kind==='filebutton')content=<div className="file-transfer-workspace"><button id="field" className="ft-btn" aria-label="Field">Action</button></div>;
else if(kind==='button')content=<button id="field" className="ft-btn" aria-label="Field">Action</button>;
else {const classes={connection:'ssh-grid',tunnel:'ssh-tunnel-field-grid',proxy:'proxy-custom-grid',security:'security-form-grid',ai:'ai-settings-form',transfer:'file-transfer-workspace'};content=<div className={classes[kind]}>{input}</div>}
flushSync(()=>root.render(<main style={{width:kind==='proxy-manager'?'100%':420,height:kind==='proxy-manager'?600:undefined,padding:30}}>{content}</main>));
};window.renderFocus('path','fileterm-light');
`
)
const baselineFiles = [...cssFiles, `${renderer}app/theme-config.ts`]
const baseline = new Map(
  baselineFiles.map((file) => [
    join(root, file),
    execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' })
  ])
)
for (const original of [false, true])
  await build({
    configFile: false,
    root: directory,
    base: original ? '/baseline/' : '/',
    logLevel: 'error',
    plugins: [
      ...(original
        ? [
            {
              name: 'baseline',
              enforce: 'pre',
              load(id) {
                return baseline.get(id)
              }
            }
          ]
        : []),
      react()
    ],
    resolve: {
      alias: [
        { find: /^react$/, replacement: require.resolve('react') },
        { find: /^react-dom$/, replacement: require.resolve('react-dom') },
        { find: /^react\/jsx-runtime$/, replacement: require.resolve('react/jsx-runtime') },
        { find: /^react-dom\/client$/, replacement: require.resolve('react-dom/client') }
      ]
    },
    build: { minify: false, outDir: join(directory, original ? 'baseline' : 'dist') }
  })
const server = createServer((request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname
    const old = path.startsWith('/baseline/')
    const relative = old ? path.slice('/baseline'.length) : path
    const data = readFileSync(join(directory, old ? 'baseline' : 'dist', relative === '/' ? 'index.html' : relative))
    response.writeHead(200, {
      'Content-Type':
        {
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.html': 'text/html',
          '.ttf': 'font/ttf',
          '.woff2': 'font/woff2',
          '.svg': 'image/svg+xml'
        }[relative === '/' ? '.html' : extname(relative)] || 'application/octet-stream'
    })
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
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
  const before = await browser.newPage({ viewport: { width: 1000, height: 700 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const url = `http://127.0.0.1:${server.address().port}`
  await Promise.all([page.goto(url), before.goto(url + '/baseline/')])
  const render = async (target, kind, theme, native = false) => {
    await target.evaluate(({ kind, theme, native }) => window.renderFocus(kind, theme, native), { kind, theme, native })
    await target.evaluate(() => {
      document.activeElement?.blur()
      return document.fonts.ready
    })
    await target.mouse.move(950, 650)
  }
  const feedback = (kind) =>
    ({
      input: '.ft-input-wrapper',
      error: '.ft-input-wrapper',
      disabled: '.ft-input-wrapper',
      filter: '.pane-filter-input-wrapper',
      command: '.command-code-area',
      dropdown: '.dropdown-select-trigger',
      toolbar: '.dropdown-select-trigger'
    })[kind] || '#field'
  const style = (target, selector) =>
    target.locator(selector).evaluate((node) => {
      const s = getComputedStyle(node),
        r = node.getBoundingClientRect()
      return {
        border: s.borderWidth === '0px' ? 'none' : s.borderColor,
        borderWidth: s.borderWidth,
        background: s.backgroundColor,
        color: s.color,
        outline: s.outline,
        shadow: s.boxShadow,
        width: r.width,
        height: r.height
      }
    })
  for (const theme of ['fileterm-dark', 'fileterm-light', 'codex-dark', 'codex-light', 'custom-dark', 'custom-light'])
    for (const kind of [
      'input',
      'textarea',
      'connection',
      'transfer',
      'tunnel',
      'proxy',
      'security',
      'ai',
      'theme',
      'path',
      'filter',
      'command',
      'dropdown',
      'toolbar',
      'terminal',
      'error',
      'checkbox',
      'filebutton',
      'button'
    ]) {
      await Promise.all([render(page, kind, theme), render(before, kind, theme)])
      const selector = feedback(kind)
      const target = page.getByLabel('Field', { exact: true })
      const old = before.getByLabel('Field', { exact: true })
      await target.hover()
      await old.hover()
      await Promise.all([page.waitForTimeout(300), before.waitForTimeout(300)])
      assert.deepEqual(await style(page, selector), await style(before, selector), `${theme} ${kind} hover unchanged`)
      await Promise.all([page.mouse.move(950, 650), before.mouse.move(950, 650)])
      await Promise.all([target.focus(), old.focus()])
      await Promise.all([page.waitForTimeout(300), before.waitForTimeout(300)])
      const focused = await style(page, selector)
      if (['terminal', 'error', 'checkbox', 'filebutton', 'button'].includes(kind)) {
        assert.deepEqual(focused, await style(before, selector), `${theme} ${kind} focus unchanged`)
        continue
      }
      assert.ok(
        focused.outline.includes('none') || focused.outline.includes('0px'),
        `${theme} ${kind} no outline: ${focused.outline}`
      )
      assert.ok(
        ['path', 'filter', 'tunnel', 'command'].includes(kind)
          ? focused.shadow === 'none'
          : focused.shadow.includes('inset'),
        `${theme} ${kind} inner focus shadow: ${focused.shadow}`
      )
      if (['input', 'filter', 'command'].includes(kind))
        assert.equal(
          await target.evaluate((node) => getComputedStyle(node).boxShadow),
          'none',
          `${kind} no duplicate inner shadow`
        )
      if (['path', 'filter', 'tunnel', 'command'].includes(kind)) {
        assert.equal(focused.borderWidth, '1px')
        assert.equal(focused.shadow, 'none')
        await target.hover()
        await page.waitForTimeout(300)
        const over = await style(page, selector)
        assert.equal(over.border, focused.border, 'focus border must not change with pointer position')
        assert.equal(over.borderWidth, '1px')
        assert.equal(over.shadow, 'none')
        await page.mouse.move(950, 650)
      }
      if (kind === 'command') {
        assert.equal(
          await page.locator('.command-code-area').evaluate((node) => getComputedStyle(node).borderLeftWidth),
          '1px'
        )
        const gutter = await page.locator('.command-line-numbers').boundingBox()
        const frame = await page.locator('.command-code-area').boundingBox()
        assert.ok(Math.abs(gutter.x - frame.x - 1) < 1, 'left frame must sit outside the line-number gutter')
      }
      if (kind === 'tunnel') {
        const font = await target.evaluate((node) => getComputedStyle(node).fontSize)
        assert.equal(
          font,
          await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--font-size-sm').trim()
          )
        )
      }
      if (kind === 'path')
        assert.notEqual(
          focused.border,
          'rgba(0, 0, 0, 0)',
          'path inset must meet its outer border without a transparent seam'
        )
      if (theme.endsWith('dark'))
        assert.equal(
          await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--input-focus-outer').trim()
          ),
          'transparent'
        )
      if (
        process.env.FILETERM_UI_ARTIFACT_DIR &&
        ['path', 'connection', 'dropdown', 'command', 'terminal'].includes(kind) &&
        !theme.startsWith('custom')
      )
        await page.locator('main').screenshot({
          path: join(process.env.FILETERM_UI_ARTIFACT_DIR, `fileterm-focus-${kind}-${theme}.png`)
        })
    }
  for (const theme of ['fileterm-dark', 'fileterm-light', 'codex-dark', 'codex-light']) {
    await render(page, 'runtime', theme)
    await page.locator('.ssh-tunnel-create-button').click()
    const input = page.locator('.ssh-tunnel-field-grid input').first()
    await input.focus()
    await page.mouse.move(950, 650)
    await page.waitForTimeout(300)
    const idle = await input.evaluate((node) => ({
      font: getComputedStyle(node).fontSize,
      shadow: getComputedStyle(node).boxShadow,
      border: getComputedStyle(node).borderColor,
      width: getComputedStyle(node).borderWidth
    }))
    assert.equal(
      idle.font,
      await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-size-sm').trim())
    )
    assert.equal(idle.shadow, 'none')
    assert.equal(idle.width, '1px')
    await input.hover()
    await page.waitForTimeout(300)
    assert.equal(await input.evaluate((node) => getComputedStyle(node).borderColor), idle.border)
    if (process.env.FILETERM_UI_ARTIFACT_DIR)
      await page
        .locator('.ssh-tunnel-dialog')
        .screenshot({ path: join(process.env.FILETERM_UI_ARTIFACT_DIR, `fileterm-focus-runtime-${theme}.png`) })
    await render(page, 'commandpreview', theme)
    await page.getByLabel('Field').focus()
    const frame = page.locator('.command-code-area')
    assert.equal(await frame.evaluate((node) => getComputedStyle(node).borderLeftWidth), '1px')
    assert.equal(await page.getByLabel('Field').evaluate((node) => getComputedStyle(node).boxShadow), 'none')
    if (process.env.FILETERM_UI_ARTIFACT_DIR)
      await page
        .locator('main')
        .screenshot({ path: join(process.env.FILETERM_UI_ARTIFACT_DIR, `fileterm-focus-preview-${theme}.png`) })
  }
  for (const theme of ['fileterm-dark', 'fileterm-light']) {
    await render(page, 'dropdown', theme, true)
    const native = page.locator('select')
    await native.focus()
    await page.waitForTimeout(300)
    assert.ok((await style(page, '.ft-select-shell')).shadow.includes('inset'))
    assert.equal(await native.evaluate((node) => getComputedStyle(node).boxShadow), 'none')
    await native.selectOption('b')
    assert.equal(await page.evaluate(() => window.chosen), 'b')
  }
  await render(page, 'dropdown', 'fileterm-dark')
  await page.getByLabel('Field').click()
  assert.ok(
    (await style(page, '.dropdown-select-trigger')).shadow.includes('inset'),
    'open dropdown shares neutral focus feedback'
  )
  assert.ok(
    (await style(page, '.dropdown-select-trigger')).outline.includes('none'),
    'open dropdown has no outer outline'
  )
  await page.getByRole('menuitem', { name: 'Remote files', exact: true }).click()
  assert.equal(await page.evaluate(() => window.chosen), 'b')
  for (const theme of ['fileterm-light', 'codex-light', 'fileterm-dark'])
    for (const width of [1000, 620]) {
      await page.setViewportSize({ width, height: 700 })
      await render(page, 'proxy-manager', theme)
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect.getComputedTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => {}))
        )
      )
      const input = page.locator('.connection-manager-search input')
      const search = page.locator('.connection-manager-search')
      const idle = await search.boundingBox()
      await input.focus()
      await page.waitForTimeout(300)
      assert.deepEqual(await search.boundingBox(), idle, 'search focus must not move the header')
      const surfaces = await input.evaluate(inspectFocusShadow)
      assert.ok(
        surfaces.every((surface) => surface.clips.length === 0),
        JSON.stringify(surfaces)
      )
      if (theme.endsWith('dark')) assert.equal(surfaces.length, 0, 'dark search has no outer shadow')
      const gutters = await search.evaluate((node) => {
        const r = node.getBoundingClientRect(),
          result = []
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent)
          if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX)) {
            const clip = parent.getBoundingClientRect()
            result.push({
              className: parent.className,
              right: clip.right - parseFloat(style.borderRightWidth || '0') - r.right
            })
          }
        }
        return result
      })
      assert.ok(gutters.length > 0, 'fixture must exercise the real clipped manager layout')
      assert.ok(
        gutters.every((g) => g.right >= 12),
        `search shadow needs room at every clipping boundary: ${JSON.stringify(gutters)}`
      )
      if (process.env.FILETERM_UI_ARTIFACT_DIR)
        await page.locator('.connection-manager-header').screenshot({
          path: join(process.env.FILETERM_UI_ARTIFACT_DIR, `fileterm-search-shadow-${theme}-${width}.png`)
        })
    }
  await page.emulateMedia({ forcedColors: 'active' })
  await render(page, 'input', 'fileterm-light')
  await page.getByLabel('Field').focus()
  assert.notEqual(await page.getByLabel('Field').evaluate((node) => getComputedStyle(node).outlineStyle), 'none')
  assert.deepEqual(errors, [])
  console.log(
    'Input focus checks passed: hover AST/baseline, six themes, ordinary and composite fields, code editor, toolbar, native select, errors/selection controls/buttons, terminal composer exception and forced colors.'
  )
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  rmSync(directory, { recursive: true, force: true })
}
