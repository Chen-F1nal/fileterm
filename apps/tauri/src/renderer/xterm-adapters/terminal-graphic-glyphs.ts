import { drawBoxDrawingGlyph, isBoxDrawingGlyph } from './box-drawing'

type BlockGlyphRect = { x: number; y: number; width: number; height: number }

export function isGraphicGlyph(codepoint: number) {
  return (codepoint >= 0x2580 && codepoint <= 0x259f) || isBoxDrawingGlyph(codepoint)
}

function snapSize(size: number, fraction: number, pixelRatio: number) {
  return Math.round(size * fraction * pixelRatio) / pixelRatio
}

function getBlockGlyphRects(codepoint: number, width: number, height: number, pixelRatio: number): BlockGlyphRect[] {
  const halfWidth = snapSize(width, 0.5, pixelRatio)
  const halfHeight = snapSize(height, 0.5, pixelRatio)
  const full = [{ x: 0, y: 0, width, height }]
  if (codepoint === 0x2580) {
    return [{ x: 0, y: 0, width, height: halfHeight }]
  }
  if (codepoint >= 0x2581 && codepoint <= 0x2587) {
    const blockHeight = snapSize(height, (codepoint - 0x2580) / 8, pixelRatio)
    return [{ x: 0, y: height - blockHeight, width, height: blockHeight }]
  }
  if (codepoint === 0x2588) {
    return full
  }
  if (codepoint >= 0x2589 && codepoint <= 0x258f) {
    const blockWidth = snapSize(width, (0x2590 - codepoint) / 8, pixelRatio)
    return [{ x: 0, y: 0, width: blockWidth, height }]
  }
  if (codepoint === 0x2590) {
    return [{ x: width - halfWidth, y: 0, width: halfWidth, height }]
  }
  if (codepoint >= 0x2591 && codepoint <= 0x2593) {
    const patterns = [
      [{ x: 0, y: 0 }],
      [
        { x: 0, y: 0 },
        { x: halfWidth, y: halfHeight }
      ],
      [
        { x: 0, y: 0 },
        { x: halfWidth, y: 0 },
        { x: 0, y: halfHeight }
      ]
    ]
    return patterns[codepoint - 0x2591].map(({ x, y }) => ({
      x,
      y,
      width: halfWidth,
      height: halfHeight
    }))
  }
  if (codepoint === 0x2594) {
    return [{ x: 0, y: 0, width, height: snapSize(height, 0.125, pixelRatio) }]
  }
  if (codepoint === 0x2595) {
    const blockWidth = snapSize(width, 0.125, pixelRatio)
    return [{ x: width - blockWidth, y: 0, width: blockWidth, height }]
  }

  const quadrants: Record<number, Array<'top left' | 'top right' | 'bottom left' | 'bottom right'>> = {
    0x2596: ['bottom left'],
    0x2597: ['bottom right'],
    0x2598: ['top left'],
    0x2599: ['top left', 'bottom left', 'bottom right'],
    0x259a: ['top left', 'bottom right'],
    0x259b: ['top left', 'top right', 'bottom left'],
    0x259c: ['top left', 'top right', 'bottom right'],
    0x259d: ['top right'],
    0x259e: ['top right', 'bottom left'],
    0x259f: ['top right', 'bottom left', 'bottom right']
  }
  const quadrantRects: Record<'top left' | 'top right' | 'bottom left' | 'bottom right', BlockGlyphRect> = {
    'top left': { x: 0, y: 0, width: halfWidth, height: halfHeight },
    'top right': { x: width - halfWidth, y: 0, width: halfWidth, height: halfHeight },
    'bottom left': { x: 0, y: height - halfHeight, width: halfWidth, height: halfHeight },
    'bottom right': { x: width - halfWidth, y: height - halfHeight, width: halfWidth, height: halfHeight }
  }
  return (quadrants[codepoint] ?? []).map((quadrant) => quadrantRects[quadrant])
}

export function drawTerminalGraphicGlyph(
  context: CanvasRenderingContext2D,
  codepoint: number,
  x: number,
  width: number,
  height: number,
  thickness: number
) {
  if (isBoxDrawingGlyph(codepoint)) {
    const curved = codepoint >= 0x256d && codepoint <= 0x2573
    if (curved) {
      context.save()
      context.beginPath()
      context.rect(x, 0, width, height)
      context.clip()
    }
    context.strokeStyle = context.fillStyle
    drawBoxDrawingGlyph(context, codepoint, x, width, height, thickness)
    if (curved) context.restore()
    return
  }
  for (const rectangle of getBlockGlyphRects(codepoint, width, height, 1)) {
    context.fillRect(x + rectangle.x, rectangle.y, rectangle.width, rectangle.height)
  }
}
