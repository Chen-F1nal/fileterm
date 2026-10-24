/* global window, document, MutationObserver, requestAnimationFrame */
/* Regression: clicking a row must not un-hide the text under the block-glyph canvas.
 * xterm rewrites a row's children on selection changes; the canvas keeps painting,
 * so a missing re-wrap shows both layers and the glyphs read as heavier.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadTypeScript } from './helpers/load-typescript.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const sharp = require(process.env.SHARP_MODULE_PATH || 'sharp')
const root = fileURLToPath(new URL('../../../../', import.meta.url))

const source = new URL('../../src/renderer/xterm-adapters/', import.meta.url)

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 500 }, deviceScaleFactor: 1.25 })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setContent('<main id="host"></main>')
  await page.addStyleTag({ path: root + 'node_modules/@xterm/xterm/css/xterm.css' })
  const font = readFileSync(
    root + 'apps/tauri/src/renderer/assets/fonts/text/jetbrains-mono/JetBrainsMono-400.ttf'
  ).toString('base64')
  await page.addStyleTag({ content: `@font-face{font-family:CellMono;src:url(data:font/ttf;base64,${font})}` })
  await page.evaluate(() => document.fonts.load('16px CellMono'))
  await page.addScriptTag({ path: root + 'node_modules/@xterm/xterm/lib/xterm.js' })
  for (const [file, symbol] of [
    ['terminal-symbol-glyph-renderer.ts', 'registerTerminalSymbolGlyphRenderer'],
    ['terminal-block-glyph-renderer.ts', 'registerTerminalBlockGlyphRenderer']
  ]) {
    await loadTypeScript(page, fileURLToPath(new URL(file, source)), symbol)
  }

  await page.evaluate(async () => {
    const terminal = new window.Terminal({
      cols: 40,
      rows: 6,
      fontFamily: 'CellMono',
      fontSize: 16,
      allowProposedApi: true,
      cursorBlink: false,
      theme: { background: '#111', foreground: '#ddd' }
    })
    terminal.open(document.getElementById('host'))
    terminal.focus()
    window.terminal = terminal
    window.registerTerminalSymbolGlyphRenderer(terminal)
    window.registerTerminalBlockGlyphRenderer(terminal)
    const line = '╏├☆╚┬┘┋╹╠├'.repeat(4)
    await new Promise((resolve) => terminal.write(Array(8).fill(line).join('\r\n'), resolve))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })

  const screen = page.locator('.xterm-screen')
  const ink = async () => {
    const raw = await sharp(await screen.screenshot())
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    let light = 0
    for (let i = 0; i < raw.data.length; i += 3) if (raw.data[i] > 150) light++
    return light
  }
  const placeholders = () => page.evaluate(() => document.querySelectorAll('.xterm-block-glyph-placeholder').length)

  const before = { ink: await ink(), placeholders: await placeholders() }
  assert.ok(before.placeholders > 0, 'graphic rows must be wrapped before the click')

  const box = await screen.boundingBox()
  await page.mouse.click(box.x + 60, box.y + 40)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const afterClick = { ink: await ink(), placeholders: await placeholders() }

  assert.equal(afterClick.placeholders, before.placeholders, 'a click must keep the text hidden under the canvas')
  assert.ok(
    Math.abs(afterClick.ink - before.ink) <= Math.max(2, before.ink * 0.005),
    `click must not add visible glyph ink (${before.ink} -> ${afterClick.ink})`
  )

  const settled = await page.evaluate(async () => {
    let mutations = 0
    const observer = new MutationObserver(() => mutations++)
    observer.observe(window.terminal.element, { childList: true, subtree: true })
    await new Promise((resolve) => setTimeout(resolve, 250))
    observer.disconnect()
    return mutations
  })
  assert.equal(settled, 0, 'the block observer must settle instead of re-wrapping forever')

  const afterScroll = await page.evaluate(async () => {
    const counts = () =>
      [...document.querySelectorAll('.xterm-rows > div')].map(
        (row) => row.querySelectorAll('.xterm-block-glyph-placeholder').length
      )
    const beforeY = window.terminal.buffer.active.viewportY
    const beforeCounts = counts()
    window.terminal.scrollLines(-1)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const scrolledY = window.terminal.buffer.active.viewportY
    const scrolledCounts = counts()
    window.terminal.scrollLines(1)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return {
      beforeY,
      beforeCounts,
      scrolledY,
      scrolledCounts,
      restoredY: window.terminal.buffer.active.viewportY,
      restoredCounts: counts()
    }
  })
  assert.ok(afterScroll.beforeY > 0, 'the fixture must produce scrollback')
  assert.equal(afterScroll.scrolledY, afterScroll.beforeY - 1, 'scrolling up must change viewportY')
  assert.equal(afterScroll.restoredY, afterScroll.beforeY, 'scrolling down must restore viewportY')
  // The cursor span splits one graphical run, so the count per row is stable but
  // the cursor row carries one extra placeholder until it scrolls out of view.
  assert.ok(
    afterScroll.scrolledCounts.every((count) => count > 0),
    'every scrolled row must stay wrapped under the canvas'
  )
  assert.deepEqual(
    afterScroll.restoredCounts,
    afterScroll.beforeCounts,
    'scrolling back must restore the same wrapping per row'
  )

  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify({
      ink: { before: before.ink, afterClick: afterClick.ink },
      placeholders: { before: before.placeholders, afterClick: afterClick.placeholders, afterScroll },
      settled
    })
  )
} finally {
  await browser.close()
}
