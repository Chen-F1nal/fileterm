type AtlasPage = {
  canvas: { width: number; height: number }
  clear(): void
  _glyphs: unknown[]
  _usedPixels: number
  currentRow?: { y: number; height: number }
}
type WebglAtlas = {
  pages: AtlasPage[]
  _activePages: AtlasPage[]
  _overflowSizePage?: AtlasPage
  _cacheMap: { clear(): void }
  _cacheMapCombined: { clear(): void }
  _didWarmUp: boolean
  _requestClearModel: boolean
  _onRemoveTextureAtlasCanvas?: { fire(canvas: AtlasPage['canvas']): void }
}

export function isWebglAtlasCacheFull(value: unknown, budget: number): boolean {
  const atlas = value as Partial<WebglAtlas> | undefined
  if (!Array.isArray(atlas?.pages)) return false
  const bytes = atlas.pages.reduce((sum, page) => sum + page.canvas.width * page.canvas.height * 4, 0)
  const usedBytes = atlas.pages.reduce(
    (sum, page) =>
      sum +
      4 *
        Math.max(
          page._usedPixels,
          page.currentRow ? page.canvas.width * (page.currentRow.y + page.currentRow.height) : 0
        ),
    0
  )
  // Retained backing pages are reusable: do not clear again until the new cache has filled them.
  return bytes > budget && usedBytes > budget / 2
}

/** Clear cached glyph ownership as well as pixels, and reuse merged pages instead of abandoning them. */
export function resetWebglAtlasCache(value: unknown): boolean {
  const atlas = value as Partial<WebglAtlas> | undefined
  // shortcut: addon-webgl 0.19 atlas internals; recheck this reset on upgrades.
  if (
    !Array.isArray(atlas?.pages) ||
    !Array.isArray(atlas._activePages) ||
    typeof atlas._cacheMap?.clear !== 'function' ||
    typeof atlas._cacheMapCombined?.clear !== 'function' ||
    typeof atlas._didWarmUp !== 'boolean' ||
    typeof atlas._requestClearModel !== 'boolean' ||
    (atlas._onRemoveTextureAtlasCanvas !== undefined && typeof atlas._onRemoveTextureAtlasCanvas.fire !== 'function') ||
    !atlas.pages.every(
      (page) => typeof page.clear === 'function' && Array.isArray(page._glyphs) && typeof page._usedPixels === 'number'
    )
  )
    return false

  for (const page of atlas.pages) {
    page.clear()
    page._glyphs.length = 0
    page._usedPixels = 0
  }
  atlas._cacheMap.clear()
  atlas._cacheMapCombined.clear()
  const reusable = atlas.pages
    .filter((page) => page !== atlas._overflowSizePage)
    .sort((a, b) => b.canvas.width - a.canvas.width)[0]
  // Empty pages still cost one texture per context. Reuse the largest page;
  // release the rest after invalidating every glyph coordinate.
  const retained = atlas.pages.filter((page) => page === reusable || page === atlas._overflowSizePage)
  for (const page of atlas.pages) {
    if (retained.includes(page)) continue
    atlas._onRemoveTextureAtlasCanvas?.fire(page.canvas)
    page.canvas.width = page.canvas.height = 0
  }
  atlas.pages.splice(0, atlas.pages.length, ...retained)
  atlas._activePages = reusable ? [reusable] : []
  atlas._didWarmUp = false
  // The caller invalidates all owners explicitly; do not leave upstream's sticky full-redraw flag set.
  atlas._requestClearModel = false
  return true
}
