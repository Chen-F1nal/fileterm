/* eslint-disable @eslint-react/dom-no-dangerously-set-innerhtml -- Only checked-in SVG assets are injected; asset tests reject executable content. */
import type { HTMLAttributes } from 'react'
import { MATERIAL_ICON_ASSETS, type MaterialIconName } from '../../../features/common/material-icon-assets'

export type { MaterialIconName }

export function MaterialIcon({
  name,
  className = 'material-symbols-outlined',
  ...props
}: Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & { name: MaterialIconName }) {
  const asset = MATERIAL_ICON_ASSETS[name]
  return (
    <span aria-hidden="true" {...props} className={className}>
      <svg
        aria-hidden="true"
        fill="currentColor"
        viewBox={asset.viewBox}
        width="1em"
        height="1em"
        dangerouslySetInnerHTML={{ __html: asset.content }}
      />
    </span>
  )
}
