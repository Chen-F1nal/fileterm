import type {
  FileTermDesktopApi,
  TransferTask,
  SshProfile,
  WorkspaceSessionSource,
  WorkspaceSnapshot,
  WorkspaceTab
} from '@fileterm/core'
import { TransferCenter } from './transfer-center'

export function TransferCenterHost({
  activeProfileId,
  showAll,
  activeTabId,
  activeTabStatus,
  activeJumpHosts,
  activeRouteTarget,
  activeTabSource,
  desktopApi,
  fullWidth,
  isPending,
  onHideToBackground,
  onApplySnapshot,
  onError,
  sessionTabs,
  transfers,
  visible
}: {
  showAll?: boolean
  activeProfileId?: string
  activeTabId: string | null
  activeTabStatus: WorkspaceTab['status'] | null
  activeJumpHosts?: SshProfile[]
  activeRouteTarget?: SshProfile
  activeTabSource: WorkspaceSessionSource | null
  desktopApi?: FileTermDesktopApi
  fullWidth: boolean
  isPending: boolean
  onHideToBackground?(tabId: string): void | Promise<void>
  onApplySnapshot(snapshot: WorkspaceSnapshot): void
  onError(scope: string, err: unknown): void
  sessionTabs: WorkspaceTab[]
  transfers: TransferTask[]
  visible: boolean
}) {
  return (
    <TransferCenter
      activeProfileId={activeProfileId}
      showAll={showAll}
      activeTabId={activeTabId}
      activeTabStatus={activeTabStatus}
      activeJumpHosts={activeJumpHosts}
      activeRouteTarget={activeRouteTarget}
      activeTabSource={activeTabSource}
      desktopApi={desktopApi}
      fullWidth={fullWidth}
      isPending={isPending}
      onHideToBackground={onHideToBackground}
      onApplySnapshot={onApplySnapshot}
      onError={onError}
      sessionTabs={sessionTabs.map((tab) => ({
        id: tab.id,
        profileId: tab.profileId
      }))}
      transfers={transfers}
      visible={visible}
    />
  )
}
