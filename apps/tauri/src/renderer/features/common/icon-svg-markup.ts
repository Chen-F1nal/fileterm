export function iconSvgMarkup(content: string, strokeWidth = 1.8) {
  return content
    .replace(/var\(--app-icon-stroke-width, [\d.]+\)/g, String(strokeWidth))
    .replace(/var\(--app-icon-scaled-stroke-width, [\d.]+\)/g, String(strokeWidth * 16))
}
