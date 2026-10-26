/* eslint-disable @eslint-react/dom-no-dangerously-set-innerhtml -- Only checked-in SVG assets are injected; asset tests reject executable content. */
import { APP_ICON_ASSETS, type AppIconName } from './app-icon-assets'
import { iconSvgMarkup } from './icon-svg-markup'

export type { AppIconName } from './app-icon-assets'

export function AppIcon({
  name,
  size = 14,
  strokeWidth = 1.8,
  className
}: {
  name: AppIconName
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const asset = APP_ICON_ASSETS[name]
  return (
    <svg
      aria-hidden="true"
      className={['app-icon', `app-icon-${name}`, className].filter(Boolean).join(' ')}
      height={size}
      viewBox={asset.viewBox}
      width={size}
      dangerouslySetInnerHTML={{ __html: iconSvgMarkup(asset.content, strokeWidth) }}
    />
  )
}
