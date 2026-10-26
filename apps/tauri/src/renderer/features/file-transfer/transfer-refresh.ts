import type { TransferTask } from '@fileterm/core'
import { areLocalPathsEqual, isLocalPathWithin, localDirname, remoteDirname } from '../../hooks/file-operations-utils'

export function shouldRefreshTransferPane(task: TransferTask, endpoint: string, path: string, profileId?: string) {
  if (task.status !== 'done') return false
  if (endpoint === 'local') {
    return (
      task.direction === 'download' &&
      (!task.destinationPath ||
        areLocalPathsEqual(localDirname(task.destinationPath), path) ||
        (task.targetType === 'folder' && isLocalPathWithin(task.destinationPath, path)))
    )
  }
  if (task.direction === 'download' || !(task.tabId === endpoint || (task.profileId && task.profileId === profileId)))
    return false
  if (!task.destinationPath) return true
  const current = path.replace(/\/+$/, '') || '/'
  const destination = task.destinationPath.replace(/\/+$/, '') || '/'
  return (
    remoteDirname(task.destinationPath) === current ||
    (task.targetType === 'folder' && (current === destination || current.startsWith(`${destination}/`)))
  )
}
