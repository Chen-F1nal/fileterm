export function parseSvgIconAsset(source: string) {
  return {
    viewBox: source.match(/\bviewBox="([^"]+)"/)![1],
    content: source.slice(source.indexOf('>') + 1, source.lastIndexOf('</svg>'))
  }
}
