/* global window, document */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const root = fileURLToPath(new URL('../../../../', import.meta.url))
const directory = mkdtempSync(join(tmpdir(), 'fileterm-log-settings-'))
let browser
try {
  writeFileSync(
    join(directory, 'fixture.tsx'),
    `
import { createRoot } from 'react-dom/client'
import { DiagnosticLogSettings } from ${JSON.stringify(join(root, 'apps/tauri/src/renderer/features/settings/settings-modal/panels/diagnostic-log-settings.tsx'))}
import { messages } from ${JSON.stringify(join(root, 'apps/tauri/src/renderer/i18n.ts'))}
import { DIAGNOSTIC_LOG_CATEGORIES } from ${JSON.stringify(join(root, 'packages/core/src/index.ts'))}
const listeners = new Set()
let preferences = { diagnosticLogCategories: Object.fromEntries(DIAGNOSTIC_LOG_CATEGORIES.map(name => [name, false])) }
window.rejectNext = false
window.requests = []
const desktopApi = {
  getUiPreferences: async () => preferences,
  onUiPreferencesChanged: listener => { listeners.add(listener); return () => listeners.delete(listener) },
  setUiPreferences: async input => {
    window.requests.push(input)
    await new Promise(resolve => setTimeout(resolve, 50))
    if (window.rejectNext) { window.rejectNext = false; throw new Error('storage unavailable') }
    preferences = { diagnosticLogCategories: { ...preferences.diagnosticLogCategories, ...input.diagnosticLogCategories } }
    for (const listener of listeners) listener(preferences)
    return preferences
  }
}
window.externalUpdate = () => {
  preferences = { diagnosticLogCategories: { ...preferences.diagnosticLogCategories, performance: true } }
  for (const listener of listeners) listener(preferences)
}
const reactRoot = createRoot(document.getElementById('root'))
window.resetPreferences = () => { preferences = { diagnosticLogCategories: Object.fromEntries(DIAGNOSTIC_LOG_CATEGORIES.map(name => [name, false])) } }
window.showLocale = locale => reactRoot.render(<DiagnosticLogSettings key={locale} desktopApi={desktopApi} t={messages[locale]} />)
window.showLocale('enUS')
`
  )
  await build({
    configFile: false,
    plugins: [react()],
    define: { 'process.env.NODE_ENV': '"production"' },
    resolve: { alias: { react: join(root, 'node_modules/react'), 'react-dom': join(root, 'node_modules/react-dom') } },
    build: {
      outDir: join(directory, 'dist'),
      lib: {
        entry: join(directory, 'fixture.tsx'),
        name: 'LogSettings',
        formats: ['iife'],
        fileName: () => 'bundle.js'
      }
    },
    logLevel: 'error'
  })
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setContent('<div id="root"></div>')
  for (const file of [
    'tokens/foundations.css',
    'tokens/fileterm-dark.css',
    'tokens/fileterm-light.css',
    'tokens/semantic.css',
    'features/common-controls.css'
  ]) {
    await page.addStyleTag({ path: join(root, 'apps/tauri/src/renderer/styles', file) })
  }
  await page.addStyleTag({
    content:
      '* { box-sizing: border-box; } body { margin: 16px; background: var(--surface-panel); color: var(--text-primary); font-family: var(--font-ui); }'
  })
  for (const file of readdirSync(join(directory, 'dist')).filter((file) => file.endsWith('.css'))) {
    await page.addStyleTag({ path: join(directory, 'dist', file) })
  }
  await page.addScriptTag({ content: readFileSync(join(directory, 'dist/bundle.js'), 'utf8') })
  await page.waitForSelector('input:not(:disabled)')
  assert.equal(await page.getByRole('checkbox').count(), 14)
  assert.equal(await page.getByRole('checkbox', { name: 'Connections & protocols', exact: true }).isChecked(), false)
  assert.equal(await page.getByRole('checkbox', { name: 'Performance & stalls', exact: true }).isChecked(), false)
  await page.getByRole('checkbox', { name: 'Connections & protocols', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('input').disabled)
  assert.equal(await page.getByRole('checkbox', { name: 'Connections & protocols', exact: true }).isChecked(), true)
  assert.deepEqual(await page.evaluate(() => window.requests), [{ diagnosticLogCategories: { connection: true } }])
  await page.evaluate(() => {
    window.rejectNext = true
  })
  await page.getByRole('checkbox', { name: 'Performance & stalls', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.getByRole('checkbox', { name: 'Performance & stalls', exact: true }).isChecked(), false)
  await page.evaluate(() => window.externalUpdate())
  await page.waitForFunction(() => [...document.querySelectorAll('input')][5].checked)
  await page.evaluate(() => window.resetPreferences())
  for (const locale of ['zhCN', 'enUS']) {
    await page.evaluate((locale) => window.showLocale(locale), locale)
    for (const [width, columns] of [
      [960, 3],
      [600, 2],
      [360, 1]
    ]) {
      await page.setViewportSize({ width, height: 900 })
      const layout = await page.locator('.diagnostic-log-grid').evaluate((grid) => ({
        columns: window.getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        height: grid.firstElementChild.getBoundingClientRect().height,
        overflow: grid.scrollWidth > grid.clientWidth
      }))
      assert.equal(layout.columns, columns)
      assert.ok(layout.height <= 42, 'single-line cards stay compact')
      assert.equal(layout.overflow, false)
      assert.equal(
        await page
          .locator('.diagnostic-log-card-label')
          .evaluateAll((labels) => labels.some((label) => label.scrollWidth > label.clientWidth)),
        false
      )
    }
    if (process.env.FILETERM_LOG_SETTINGS_SCREENSHOT_DIR) {
      await page.setViewportSize({ width: 960, height: 460 })
      for (const theme of ['fileterm-dark', 'fileterm-light']) {
        await page.evaluate((theme) => {
          document.documentElement.dataset.theme = theme
        }, theme)
        await page.screenshot({
          path: join(process.env.FILETERM_LOG_SETTINGS_SCREENSHOT_DIR, theme + '-' + locale + '.png')
        })
      }
    }
  }
  assert.deepEqual(errors, [])
  console.log(
    '14 log categories: defaults, partial save, failure rollback, external preference update, and compact 3/2/1-column layout passed.'
  )
} finally {
  await browser?.close()
  rmSync(directory, { recursive: true, force: true })
}
