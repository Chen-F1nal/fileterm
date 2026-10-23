/* global requestAnimationFrame */

/** Mark pixels outside a cached glyph, then sample the first, middle and last screen rows. */
export async function probeWebglGlyphEdges(terminal) {
  const rows = [...new Set([0, Math.floor(terminal.rows / 2), terminal.rows - 1])]
  terminal.clearTextureAtlas()
  await new Promise((resolve) =>
    terminal.write(
      '\x1b[?25l\x1b[0m\x1b[2J' +
        rows.map((row) => `\x1b[${row + 1};1H${'I'.repeat(Math.max(1, terminal.cols - 1))}`).join(''),
      resolve
    )
  )
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const renderer = terminal._core._renderService._renderer.value
  const glyph = renderer._glyphRenderer.value
  const gl = renderer._gl
  renderer.renderRows(0, terminal.rows - 1)
  const attributes = glyph._vertices.attributes
  // The first column can clip a glyph's left overhang; marking that clipped edge would poison the same glyph in other columns.
  let index = -1
  for (let i = 0; i < attributes.length; i += 11)
    if (attributes[i + 2] > 0 && (index < 0 || attributes[i + 7] > attributes[index + 7])) index = i
  if (index < 0) throw new Error('Glyph edge probe has no visible glyph')
  const page = glyph._atlas.pages[attributes[index + 4]]
  const x = Math.round(attributes[index + 5] * page.canvas.width)
  const y = Math.round(attributes[index + 6] * page.canvas.height)
  const width = Math.round(attributes[index + 7] * page.canvas.width)
  const height = Math.round(attributes[index + 8] * page.canvas.height)
  const original = page.ctx.getImageData(x, y, width, height)
  // A magenta border exposes neighbor sampling even when real atlas neighbors happen to be empty.
  page.ctx.fillStyle = '#ff00ff'
  page.ctx.fillRect(x - 1, y - 1, width + 2, height + 2)
  page.ctx.putImageData(original, x, y)
  page.version++
  try {
    renderer.renderRows(0, terminal.rows - 1)
    let outsideGlyphPixels = 0
    let misalignedGlyphs = 0
    let pixelCount = 0
    for (const row of rows) {
      const top = Math.max(0, Math.floor((row * gl.canvas.height) / terminal.rows) - 2)
      const height = Math.min(gl.canvas.height - top, Math.ceil(gl.canvas.height / terminal.rows) + 4)
      const pixels = new Uint8Array(gl.canvas.width * height * 4)
      gl.readPixels(0, gl.canvas.height - top - height, gl.canvas.width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      pixelCount += pixels.length / 4
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] > 240 && pixels[i + 1] < 10 && pixels[i + 2] > 240) outsideGlyphPixels++
      for (let column = 0; column < terminal.cols - 1; column++) {
        const i = (row * terminal.cols + column) * 11
        const px = attributes[i + 9] * gl.canvas.width + attributes[i]
        const py = attributes[i + 10] * gl.canvas.height + attributes[i + 1]
        if (Math.abs(px - Math.round(px)) > 0.005 || Math.abs(py - Math.round(py)) > 0.005) misalignedGlyphs++
      }
    }
    return {
      outsideGlyphPixels,
      misalignedGlyphs,
      atlasCell: [glyph._atlas._config.deviceCellWidth, glyph._atlas._config.deviceCellHeight],
      fractionalAtlasGlyphs: glyph._atlas.pages
        .flatMap((page) => page.glyphs)
        .filter((glyph) =>
          [glyph.size.x, glyph.size.y, glyph.texturePosition.x, glyph.texturePosition.y].some(
            (value) => !Number.isInteger(value)
          )
        ).length,
      glyphRectangles: outsideGlyphPixels
        ? [
            ...new Set(
              Array.from({ length: terminal.cols - 1 }, (_, column) => {
                const i = column * 11
                return JSON.stringify(Array.from(attributes.slice(i + 4, i + 9)))
              })
            )
          ]
        : [],
      glyphDiagnostic: outsideGlyphPixels
        ? {
            picked: { x, y, width, height, pageWidth: page.canvas.width, pageHeight: page.canvas.height },
            config: glyph._atlas._config,
            model: [...renderer._model.cells.slice(0, 4)],
            cached: glyph._atlas._cacheMap.get(
              73,
              renderer._model.cells[1],
              renderer._model.cells[2],
              renderer._model.cells[3]
            ),
            text: terminal.buffer.active.getLine(terminal.buffer.active.viewportY).translateToString(true).slice(0, 20)
          }
        : null,
      pixelCount,
      backing: [gl.canvas.width, gl.canvas.height],
      viewport: [...gl.getParameter(gl.VIEWPORT)],
      grid: [terminal.cols, terminal.rows],
      error: gl.getError()
    }
  } finally {
    terminal.clearTextureAtlas()
  }
}
