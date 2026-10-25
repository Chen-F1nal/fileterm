// Run with Playwright installed, or set PLAYWRIGHT_MODULE_PATH.
/* global document, getComputedStyle, requestAnimationFrame */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const renderer = new URL('../../src/renderer/', import.meta.url)
function stylesheet(url) {
  return readFileSync(url, 'utf8').replace(/@import\s+['"]([^'"]+)['"]\s*;/g, (_, path) =>
    stylesheet(new URL(path, url))
  )
}
const css = ['styles/index.css', 'features/layout/app-main-workspace.css']
  .map((path) => stylesheet(new URL(path, renderer)))
  .join('\n')
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })
try {
  const page = await browser.newPage({ viewport: { width: 1150, height: 820 } })
  await page.setContent(`
    <div class="fs-shell" style="--sidebar-width:220px;--brand-width:220px">
      <div class="fs-tabbar"><div class="titlebar-brand">FileTerm</div><div></div></div>
      <aside class="fs-sidebar"></aside>
      <main class="fs-main no-status"><div class="workspace-stage"></div></main>
      <div class="terminal-right-frame"></div>
      <div class="transfer-strip"></div>
    </div>`)
  await page.addStyleTag({ content: css })
  for (const platform of ['darwin', 'win32', 'linux']) {
    for (const theme of ['fileterm-light', 'fileterm-dark', 'codex-light', 'codex-dark']) {
      await page.evaluate(
        ({ platform, theme }) => {
          document.documentElement.dataset.platform = platform
          document.documentElement.dataset.theme = theme
          const frame = document.querySelector('.terminal-right-frame')
          frame.classList.remove('is-visible')
          for (const animation of frame.getAnimations()) animation.finish()
          frame.getBoundingClientRect()
        },
        { platform, theme }
      )
      for (const visible of [true, false, true]) {
        const geometry = await page.evaluate(async (visible) => {
          const shell = document.querySelector('.fs-shell')
          const frame = document.querySelector('.terminal-right-frame')
          frame.getBoundingClientRect()
          // The real home workspace spans the shell and supplies its own sidebar;
          // here we measure the shared grid track and titlebar boundary.
          shell.classList.toggle('is-home-active', !visible)
          frame.classList.toggle('is-visible', visible)
          await new Promise(requestAnimationFrame)
          const animation = frame.getAnimations().find((item) => item.transitionProperty === 'width')
          const hasTransition = Boolean(animation)
          if (animation) {
            animation.pause()
            animation.currentTime = 120
          }
          const halfwayWidth = frame.getBoundingClientRect().width
          for (const item of frame.getAnimations()) item.finish()
          return {
            sidebar: parseFloat(getComputedStyle(shell).gridTemplateColumns),
            brand: document.querySelector('.titlebar-brand').getBoundingClientRect().width,
            frame: frame.getBoundingClientRect().width,
            halfwayWidth,
            hasTransition
          }
        }, visible)
        assert.equal(geometry.sidebar, 220, `${platform}/${theme}: sidebar must not move`)
        assert.equal(geometry.brand, 220, `${platform}/${theme}: titlebar must align`)
        assert.equal(geometry.frame, visible ? 12 : 0)
        assert.ok(geometry.hasTransition, `${platform}/${theme}/${visible}: opening and closing must animate`)
        assert.ok(geometry.halfwayWidth > 0 && geometry.halfwayWidth < 12)
      }
    }
  }
  const interruptedWidth = await page.evaluate(() => {
    const frame = document.querySelector('.terminal-right-frame')
    frame.classList.remove('is-visible')
    for (const animation of frame.getAnimations()) {
      animation.pause()
      animation.currentTime = 60
    }
    frame.getBoundingClientRect()
    frame.classList.add('is-visible')
    for (const animation of frame.getAnimations()) animation.finish()
    return frame.getBoundingClientRect().width
  })
  assert.equal(interruptedWidth, 12, 'a reversed transition must settle at the latest requested width')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reduced = await page.evaluate(() => {
    const frame = document.querySelector('.terminal-right-frame')
    frame.classList.remove('is-visible')
    return { width: frame.getBoundingClientRect().width, duration: getComputedStyle(frame).transitionDuration }
  })
  assert.deepEqual(reduced, { width: 0, duration: '0s' })
  console.log(
    'PASS: stable sidebar/titlebar and animated frame in 36 switches, four themes, three platform styles; reduced motion'
  )
} finally {
  await browser.close()
}
