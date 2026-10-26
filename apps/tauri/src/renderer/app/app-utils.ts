import type { DragEvent, MouseEvent } from 'react'
import type { LocalFileItem, TransferTask, WorkspaceTab } from '@fileterm/core'
import { APP_ICON_ASSETS, type AppIconName } from '../features/common/app-icon-assets'
import { iconSvgMarkup } from '../features/common/icon-svg-markup'
import { formatMessage, localizeErrorScope, t } from '../i18n'

export const localFileDragType = 'application/x-fileterm-local-file'
export const remoteFileDragType = 'application/x-fileterm-remote-file'
export const WINDOWS_DRIVES_PATH = 'fileterm://windows-drives'

function clipboardError(lastError: unknown) {
  return lastError instanceof Error ? lastError : new Error('Clipboard is unavailable')
}

function browserReadClipboard(): Promise<string> | null {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
    return null
  }

  return navigator.clipboard.readText()
}

function nativeReadClipboard(): Promise<string> | null {
  return window.fileterm?.readClipboardText?.() ?? null
}

function browserWriteClipboard(value: string): Promise<void> | null {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return null
  }

  return navigator.clipboard.writeText(value)
}

function nativeWriteClipboard(value: string): Promise<void> | null {
  return window.fileterm?.writeClipboardText?.(value) ?? null
}

function legacyWriteClipboard(value: string): boolean {
  if (typeof document === 'undefined' || !document.execCommand) {
    return false
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.setAttribute('aria-hidden', 'true')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

/**
 * GNOME/Wayland may not expose either data-control protocol required by
 * arboard. Prefer the WebView clipboard there, while retaining native and
 * legacy fallbacks for other desktop/runtime combinations.
 */
export async function readClipboardText(): Promise<string> {
  let lastError: unknown = null
  const readers =
    window.fileterm?.platform === 'linux'
      ? [browserReadClipboard, nativeReadClipboard]
      : [nativeReadClipboard, browserReadClipboard]

  for (const read of readers) {
    try {
      const attempt = read()
      if (!attempt) {
        continue
      }

      return await attempt
    } catch (error) {
      lastError = error
    }
  }

  throw clipboardError(lastError)
}

export async function writeClipboardText(value: string): Promise<void> {
  let lastError: unknown = null
  const writers =
    window.fileterm?.platform === 'linux'
      ? [browserWriteClipboard, nativeWriteClipboard]
      : [nativeWriteClipboard, browserWriteClipboard]

  for (const write of writers) {
    try {
      const attempt = write(value)
      if (!attempt) {
        continue
      }

      await attempt
      return
    } catch (error) {
      lastError = error
    }
  }

  try {
    if (legacyWriteClipboard(value)) {
      return
    }
  } catch (error) {
    lastError = error
  }

  throw clipboardError(lastError)
}

export function isActiveTransfer(transfer: TransferTask) {
  return (
    transfer.status === 'running' ||
    transfer.status === 'queued' ||
    transfer.status === 'verifying' ||
    transfer.status === 'finalizing'
  )
}

export function isCompletedTransfer(transfer: TransferTask) {
  return transfer.status === 'done' || transfer.status === 'failed' || transfer.status === 'canceled'
}

export function copyText(value: string) {
  void writeClipboardText(value).catch(() => undefined)
}

export function hasSelectedText() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return false
  }

  return selection.toString().trim().length > 0
}

export function settledResultsError(action: string, results: PromiseSettledResult<unknown>[]): Error | null {
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (!failures.length) {
    return null
  }
  const firstReason = failures[0]?.reason
  const detail = firstReason instanceof Error ? firstReason.message : String(firstReason ?? '')
  const summary = formatMessage(t.operationFailedSummary, {
    action: localizeErrorScope(action),
    failed: failures.length,
    total: results.length
  })
  return new Error(detail ? `${summary}；${detail}` : summary)
}

export function homeTabKey(id: string) {
  return `home:${id}`
}

export function sessionTabKey(id: string) {
  return `session:${id}`
}

export function reorderTabKeys(keys: string[], draggingKey: string | null, targetKey: string) {
  if (!draggingKey || draggingKey === targetKey) {
    return keys
  }

  const draggingIndex = keys.indexOf(draggingKey)
  const targetIndex = keys.indexOf(targetKey)
  if (draggingIndex === -1 || targetIndex === -1) {
    return keys
  }

  const next = [...keys]
  next.splice(draggingIndex, 1)
  next.splice(targetIndex, 0, draggingKey)
  return next
}

export function insertTabKeyAfter(keys: string[], newKey: string, afterKey: string | null) {
  const withoutNewKey = keys.filter((key) => key !== newKey)
  if (!afterKey) {
    return [...withoutNewKey, newKey]
  }

  const targetIndex = withoutNewKey.indexOf(afterKey)
  if (targetIndex === -1) {
    return [...withoutNewKey, newKey]
  }

  const next = [...withoutNewKey]
  next.splice(targetIndex + 1, 0, newKey)
  return next
}

export function tabStatusClass(status: WorkspaceTab['status']) {
  if (status === 'connected') {
    return 'connected'
  }
  if (status === 'error' || status === 'closed') {
    return 'disconnected'
  }
  if (status === 'connecting') {
    return 'connecting'
  }
  return 'idle'
}

export function withParentRow(dirPath: string, items: LocalFileItem[], rootPath?: string) {
  const normalizedPath = dirPath
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLocaleLowerCase()
  const normalizedRoot = rootPath
    ?.replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLocaleLowerCase()
  const windowsRoot = /^[A-Za-z]:[\\/]?$/.test(dirPath) ? WINDOWS_DRIVES_PATH : null
  const isAtRoot = normalizedRoot !== undefined && normalizedPath === normalizedRoot
  const rawParentPath = dirPath.includes('/')
    ? dirPath.split('/').slice(0, -1).join('/') || '/'
    : dirPath.includes('\\')
      ? windowsRoot || dirPath.split('\\').slice(0, -1).join('\\') || '\\'
      : dirPath
  const parentPath = /^[A-Za-z]:$/.test(rawParentPath) ? `${rawParentPath}\\` : rawParentPath
  return dirPath === '/' || dirPath === WINDOWS_DRIVES_PATH || isAtRoot
    ? items
    : [
        {
          path: parentPath,
          name: '..',
          type: 'folder' as const,
          modified: '',
          size: '-'
        },
        ...items
      ]
}

export function nextSelection<T extends { path: string }>({
  anchorPath,
  currentSelection,
  event,
  itemPath,
  rows
}: {
  anchorPath: string | null
  currentSelection: string[]
  event: MouseEvent<HTMLTableRowElement>
  itemPath: string
  rows: T[]
}) {
  if (event.shiftKey && anchorPath) {
    const anchorIndex = rows.findIndex((row) => row.path === anchorPath)
    const itemIndex = rows.findIndex((row) => row.path === itemPath)
    if (anchorIndex !== -1 && itemIndex !== -1) {
      const start = Math.min(anchorIndex, itemIndex)
      const end = Math.max(anchorIndex, itemIndex)
      return rows.slice(start, end + 1).map((row) => row.path)
    }
  }

  if (event.metaKey || event.ctrlKey) {
    return currentSelection.includes(itemPath)
      ? currentSelection.filter((selectedPath) => selectedPath !== itemPath)
      : [...currentSelection, itemPath]
  }

  return [itemPath]
}

export function rangePaths<T extends { path: string }>(rows: T[], startPath: string, endPath: string) {
  const startIndex = rows.findIndex((row) => row.path === startPath)
  const endIndex = rows.findIndex((row) => row.path === endPath)
  if (startIndex === -1 || endIndex === -1) {
    return endPath ? [endPath] : []
  }
  const start = Math.min(startIndex, endIndex)
  const end = Math.max(startIndex, endIndex)
  return rows.slice(start, end + 1).map((row) => row.path)
}

export function mergeUnique(values: string[]) {
  return Array.from(new Set(values))
}

export function parseDraggedPaths(payload: string) {
  try {
    const parsed = JSON.parse(payload)
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [payload]
  } catch {
    return [payload]
  }
}

const DRAG_PREVIEW_ICON_NAMES = new Set<AppIconName>([
  'folder',
  'file',
  'archive',
  'video',
  'audio',
  'image',
  'document',
  'spreadsheet',
  'presentation',
  'config-file',
  'database',
  'font-file',
  'package',
  'terminal-file',
  'pdf',
  'code',
  'disk'
])

export function setFileDragPreview(event: DragEvent<HTMLElement>, names: string[], iconName: AppIconName = 'file') {
  if (!names.length) {
    return
  }

  const preview = document.createElement('div')
  preview.className = 'file-drag-preview'
  const visibleNames = names.slice(0, 2)
  const icon = APP_ICON_ASSETS[DRAG_PREVIEW_ICON_NAMES.has(iconName) ? iconName : 'file']
  preview.innerHTML = `
    <span class="file-drag-preview-icon" aria-hidden="true">
      <svg class="app-icon" viewBox="${icon.viewBox}" width="14" height="14">${iconSvgMarkup(icon.content)}</svg>
    </span>
    <span>${escapeHtml(visibleNames.join(names.length > 1 ? ', ' : ''))}${names.length > 2 ? ` ${t.moreItemsPrefix ? `${t.moreItemsPrefix} ` : ''}${names.length} ${t.itemsSuffix}` : ''}</span>
  `
  document.body.appendChild(preview)
  event.dataTransfer.setDragImage(preview, 10, 10)
  window.setTimeout(() => preview.remove(), 0)
}

export function transferStatusText(transfer: TransferTask) {
  if (transfer.status === 'failed') {
    if (transfer.direction === 'copy') return t.fileTransferCopyFailed
    return transfer.direction === 'upload' ? t.uploadFailed : t.downloadFailed
  }
  if (transfer.status === 'canceled') {
    if (transfer.direction === 'copy') return t.fileTransferCopyCanceled
    return transfer.direction === 'upload' ? t.uploadCanceled : t.downloadCanceled
  }
  if (transfer.status === 'done') {
    if (transfer.direction === 'copy') return t.fileTransferCopyDone
    return transfer.direction === 'upload' ? t.uploadDone : t.downloadDone
  }
  if (transfer.status === 'queued') {
    if (transfer.direction === 'copy') return t.fileTransferCopyWaiting
    return transfer.direction === 'upload' ? t.waitingUpload : t.waitingDownload
  }
  if (transfer.status === 'paused') {
    return t.transferPaused
  }
  if (transfer.status === 'interrupted') {
    return t.transferInterrupted
  }
  if (transfer.status === 'verifying') {
    return t.transferVerifying
  }
  if (transfer.status === 'finalizing') {
    return t.transferFinalizing
  }
  if (transfer.direction === 'copy') return t.fileTransferCopyRunning
  return transfer.direction === 'upload' ? t.uploading : t.downloading
}

export function getTransferTimestamp(transfer: TransferTask) {
  return transfer.updatedAt ?? transfer.createdAt
}

export function formatTransferDateTime(timestamp?: number) {
  if (timestamp === undefined || !Number.isFinite(timestamp)) {
    return undefined
  }

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`
}

export function formatTransferBytes(bytes?: number) {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return undefined
  }
  if (bytes >= 1024 ** 4) {
    return `${(bytes / 1024 ** 4).toFixed(bytes >= 10 * 1024 ** 4 ? 0 : 1)} TB`
  }
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(bytes >= 10 * 1024 ** 3 ? 0 : 1)} GB`
  }
  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(bytes >= 10 * 1024 ** 2 ? 0 : 1)} MB`
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  return `${bytes} B`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
