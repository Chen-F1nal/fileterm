import type { IDisposable } from '@xterm/xterm'

type TextureSlot = { texture: WebGLTexture; version: number }
type GlyphRenderer = {
  _atlas?: { pages: Array<{ canvas: { width: number; height: number } }> }
  _atlasTextures: TextureSlot[]
  render(...args: unknown[]): void
}

/** Keep per-renderer GPU slots aligned with the current (possibly shared) CPU atlas. */
export function registerWebglTextureSlots(gl: WebGL2RenderingContext, value: unknown): IDisposable {
  const glyph = value as GlyphRenderer | undefined
  // shortcut: addon-webgl 0.19 owns mutable slots captured by its disposal callbacks; recheck on upgrade.
  if (
    typeof glyph?.render !== 'function' ||
    !Array.isArray(glyph._atlasTextures) ||
    !glyph._atlasTextures.every((slot) => slot.texture && typeof slot.version === 'number')
  )
    throw new Error('Unsupported xterm WebGL textures; use DOM')

  const sizes = new Map<TextureSlot, { width: number; height: number }>()
  const originalRender = glyph.render
  const render = function (this: GlyphRenderer, ...args: unknown[]) {
    if (this._atlas) {
      for (const [index, slot] of this._atlasTextures.entries()) {
        const page = this._atlas.pages[index]
        const width = page?.canvas.width ?? 1
        const height = page?.canvas.height ?? 1
        const previous = sizes.get(slot)
        if (previous?.width === width && previous.height === height) continue
        const texture = gl.createTexture()
        // Keep the existing texture usable if the context cannot allocate a replacement.
        if (!texture) continue
        gl.activeTexture(gl.TEXTURE0 + index)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        if (!page)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 0, 255]))
        // Redefining level zero alone leaves unused slots and old higher mip levels allocated.
        gl.deleteTexture(slot.texture)
        slot.texture = texture
        slot.version = -1
        sizes.set(slot, { width, height })
      }
    }
    originalRender.apply(this, args)
  }
  glyph.render = render
  return {
    dispose() {
      if (glyph.render === render) glyph.render = originalRender
      sizes.clear()
    }
  }
}
