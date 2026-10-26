// Run with Playwright installed, or set PLAYWRIGHT_MODULE_PATH.
/* global document, getComputedStyle, requestAnimationFrame */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const renderer = new URL('../../src/renderer/', import.meta.url)
function stylesheet(url) {
  return readFileSync(url, 'utf8').replace(/@import\s+['"]([^'"]+)['"]\s*;/g, (_, path) =>
    stylesheet(new URL(path, url))
  )
}
const css = [
  'features/layout/app-main-workspace.css',
  'features/layout/tab-bar.css',
  'features/workspace/local-terminal-frame.css',
  'features/file-transfer/file-transfer-workspace.css',
  'styles/index.css'
]
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
      <div class="workspace-left-frame"></div>
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
          const shell = document.querySelector('.fs-shell')
          shell.classList.remove('has-workspace-left-frame', 'is-local-terminal', 'is-home-active')
          for (const animation of shell.getAnimations()) animation.finish()
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
      for (const view of ['local', 'transfer', 'remote']) {
        const geometry = await page.evaluate((view) => {
          const shell = document.querySelector('.fs-shell')
          shell.classList.toggle('is-local-terminal', view === 'local')
          shell.classList.toggle('has-workspace-left-frame', view !== 'remote')
          document.querySelector('.fs-main').classList.toggle('full-width', view !== 'remote')
          const stage = document.querySelector('.workspace-stage')
          stage.innerHTML = `<div class="workspace-stage-transition is-transitioning"><div class="workspace-content-stack"><div class="workspace-content-stack__item is-active">${
            view === 'local'
              ? '<section class="local-terminal-workspace"><div class="local-terminal-frame"><div class="local-terminal-frame-left"></div><div class="local-terminal-surface">Terminal</div><div class="local-terminal-frame-right"></div><div class="local-terminal-frame-bottom"></div></div></section>'
              : view === 'transfer'
                ? '<section class="file-transfer-workspace"><header>Transfers</header><div class="file-transfer-workspace__panes"><div class="file-transfer-pane">Left</div><div class="file-transfer-pane">Right</div></div></section>'
                : '<section>Remote terminal</section>'
          }</div></div></div>`
          const frame = document.querySelector('.terminal-right-frame')
          const root = document.querySelector('.workspace-content-stack__item > section')
          for (const animation of shell.getAnimations()) animation.finish()
          const leftFrame = document.querySelector('.workspace-left-frame')
          const panes = document.querySelectorAll('.file-transfer-pane')
          const bottomFrame = document.querySelector('.local-terminal-frame-bottom')
          const corner = getComputedStyle(frame, '::after')
          return {
            right: frame.getBoundingClientRect().right,
            width: frame.getBoundingClientRect().width,
            animations: frame.getAnimations().length,
            gaps:
              view === 'transfer'
                ? {
                    left: panes[0].getBoundingClientRect().left - leftFrame.getBoundingClientRect().right,
                    right: frame.getBoundingClientRect().left - panes[1].getBoundingClientRect().right
                  }
                : null,
            bottomCorner:
              view === 'local'
                ? {
                    height: parseFloat(corner.height),
                    top: frame.getBoundingClientRect().bottom - parseFloat(corner.height),
                    borderTop: corner.borderTopWidth,
                    borderLeft: corner.borderLeftWidth,
                    background: corner.backgroundColor,
                    bottomTop: bottomFrame.getBoundingClientRect().top,
                    bottomBackground: getComputedStyle(bottomFrame).backgroundColor
                  }
                : null,
            leftWidth: leftFrame
              ? leftFrame.getBoundingClientRect().width
              : view === 'transfer'
                ? parseFloat(getComputedStyle(root, '::before').width)
                : null,
            rootAnimations: root.getAnimations().length,
            contentAnimations:
              view === 'local'
                ? document.querySelector('.local-terminal-surface').getAnimations().length
                : view === 'transfer'
                  ? root.querySelector('header').getAnimations().length
                  : null,
            innerRightDisplay:
              view === 'local'
                ? getComputedStyle(document.querySelector('.local-terminal-frame-right')).display
                : view === 'transfer'
                  ? getComputedStyle(root, '::after').display
                  : null
          }
        }, view)
        assert.equal(geometry.width, 12, `${platform}/${theme}/${view}: shared right edge width`)
        assert.equal(geometry.right, 1150, `${platform}/${theme}/${view}: shared right edge position`)
        assert.equal(geometry.animations, 0, 'identical edges must not replay transitions')
        if (view === 'transfer')
          assert.deepEqual(
            geometry.gaps,
            { left: 12, right: 12 },
            'file panes must have equal gaps inside both edge frames'
          )
        if (view === 'local') {
          const corner = geometry.bottomCorner
          assert.equal(corner.height, 12)
          assert.equal(corner.top, corner.bottomTop, 'bottom divider must continue horizontally across the right edge')
          assert.equal(corner.borderTop, '1px')
          assert.equal(corner.borderLeft, '0px', 'the vertical divider must stop above the bottom strip')
          assert.equal(corner.background, corner.bottomBackground, 'the corner must cover the vertical frame shadow')
        }
        if (view !== 'remote') {
          assert.equal(geometry.leftWidth, 12, `${view}: left edge must use the same thickness`)
          assert.equal(geometry.rootAnimations, 0, 'content entry animations must not fade edge frames')
          assert.equal(geometry.contentAnimations, 1, 'workspace contents must keep their entry animation')
          assert.equal(geometry.innerRightDisplay, 'none', 'the shared edge must replace the inner right edge')
        }
        if (
          process.env.FILETERM_UI_ARTIFACT_DIR &&
          platform === 'darwin' &&
          theme === 'fileterm-dark' &&
          view !== 'remote'
        ) {
          await page.screenshot({ path: join(process.env.FILETERM_UI_ARTIFACT_DIR, `workspace-frame-${view}.png`) })
        }
      }
      for (const fromHome of [false, true]) {
        for (const local of [false, true]) {
          const movement = await page.evaluate(
            async ({ fromHome, local }) => {
              const shell = document.querySelector('.fs-shell')
              const main = document.querySelector('.fs-main')
              const frame = document.querySelector('.terminal-right-frame')
              shell.classList.remove('has-workspace-left-frame', 'is-local-terminal')
              shell.classList.toggle('is-home-active', fromHome)
              frame.classList.toggle('is-visible', !fromHome)
              main.classList.toggle('full-width', fromHome)
              for (const animation of shell.getAnimations()) animation.finish()
              for (const animation of frame.getAnimations()) animation.finish()
              shell.getBoundingClientRect()
              shell.classList.remove('is-home-active')
              shell.classList.add('has-workspace-left-frame')
              shell.classList.toggle('is-local-terminal', local)
              main.classList.add('full-width')
              frame.classList.add('is-visible')
              await new Promise(requestAnimationFrame)
              const animation = shell
                .getAnimations()
                .find((item) => item.transitionProperty === 'grid-template-columns')
              if (animation) {
                animation.pause()
                animation.currentTime = 120
              }
              const halfway = main.getBoundingClientRect().left
              for (const item of shell.getAnimations()) item.finish()
              for (const item of frame.getAnimations()) item.finish()
              return { animated: Boolean(animation), halfway, end: main.getBoundingClientRect().left }
            },
            { fromHome, local }
          )
          assert.ok(movement.animated, `${platform}/${theme}: wide-to-thin layout must animate`)
          assert.ok(movement.halfway > 12 && movement.halfway < 220, 'content must move with the narrowing sidebar')
          assert.equal(movement.end, 12)
        }
      }
      const ftpDivider = await page.evaluate(() => {
        const fixture = document.createElement('div')
        fixture.innerHTML =
          '<section class="session-workspace file-only"><div class="file-tabs"></div></section><section class="session-workspace"><div class="file-tabs"></div></section>'
        document.body.append(fixture)
        const ftp = getComputedStyle(fixture.querySelector('.file-only .file-tabs')).borderTopWidth
        const ssh = getComputedStyle(
          fixture.querySelector('.session-workspace:not(.file-only) .file-tabs')
        ).borderTopWidth
        const titlebar = getComputedStyle(document.querySelector('.fs-tabbar'), '::after').height
        fixture.remove()
        return { ftp, ssh, titlebar }
      })
      assert.equal(ftpDivider.ftp, '0px', `${platform}/${theme}: FTP must not duplicate the titlebar divider`)
      assert.equal(ftpDivider.titlebar, '1px')
      if (theme.endsWith('dark')) assert.equal(ftpDivider.ssh, '1px', 'SSH retains its terminal/file separator')
      const hiddenTools = await page.evaluate(() => {
        const fixture = document.createElement('div')
        fixture.className = 'workspace-content-stack'
        fixture.innerHTML =
          '<div class="workspace-content-stack__item is-active"><section class="home-workspace"><header class="home-tabs-bar"><div class="fs-tabbar"><button class="add-tab">+</button><div class="window-tools"><button><span class="window-tool-icon window-tool-icon--settings"></span></button></div></div></header></section></div>'
        document.body.append(fixture)
        const button = fixture.querySelector('.window-tools button')
        const add = fixture.querySelector('.add-tab')
        const icon = fixture.querySelector('.window-tool-icon')
        button.getBoundingClientRect()
        fixture.firstElementChild.classList.remove('is-active')
        const visibility = {
          button: getComputedStyle(button).visibility,
          icon: getComputedStyle(icon).visibility,
          add: getComputedStyle(add).visibility
        }
        fixture.remove()
        return visibility
      })
      assert.deepEqual(
        hiddenTools,
        { button: 'hidden', icon: 'hidden', add: 'hidden' },
        `${platform}/${theme}: cached home tools must hide on the first frame`
      )
    }
  }
  const dragging = await page.evaluate(() => {
    const shell = document.querySelector('.fs-shell')
    const home = document.createElement('div')
    home.className = 'home-workspace'
    document.querySelector('.workspace-stage').append(home)
    shell.classList.add('is-resizing-sidebar')
    const duration = {
      shell: getComputedStyle(shell).transitionDuration,
      home: getComputedStyle(home).transitionDuration
    }
    home.remove()
    shell.classList.remove('is-resizing-sidebar')
    return duration
  })
  assert.deepEqual(dragging, { shell: '0s', home: '0s' }, 'manual dragging must not trail behind the pointer')
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
    return {
      width: frame.getBoundingClientRect().width,
      duration: getComputedStyle(frame).transitionDuration,
      shellDuration: getComputedStyle(document.querySelector('.fs-shell')).transitionDuration
    }
  })
  assert.deepEqual(reduced, { width: 0, duration: '0s', shellDuration: '0s' })
  console.log(
    'PASS: 36 home/remote, 36 shared-edge and 48 wide-to-thin switches, four themes, three platform styles; symmetric gutters, stable edges, content-only fades and reduced motion'
  )
} finally {
  await browser.close()
}
