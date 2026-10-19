import type { SessionSnapshot } from '@fileterm/core'

export interface MonitoringTarget {
  tabId: string
  session: SessionSnapshot
}

export interface MonitoringSource {
  tabId: string | null
  session: SessionSnapshot | null
  /** Every live session on the same machine, so stop/start applies to all of them. */
  peers: MonitoringTarget[]
}

/**
 * Sessions opened from one profile share a single collector: a session in the
 * `shared` phase shows the samples of the tab that collects for its machine.
 */
export function resolveMonitoringSource(
  tabId: string | null,
  sessions: Readonly<Record<string, SessionSnapshot>>
): MonitoringSource {
  const own = tabId ? (sessions[tabId] ?? null) : null
  const leaderTabId = own?.monitoring?.phase === 'shared' ? own.monitoring.sharedFromTabId : undefined
  const leader = leaderTabId ? sessions[leaderTabId] : undefined
  const source =
    leaderTabId && leader?.connected && leader.profileId === own?.profileId
      ? { tabId: leaderTabId, session: leader }
      : { tabId, session: own }
  const peers = source.session
    ? Object.entries(sessions)
        .filter(
          ([, session]) =>
            session.profileId === source.session?.profileId &&
            session.connected &&
            session.monitoring &&
            session.capabilities?.resourceMonitoring !== false
        )
        .map(([peerTabId, session]) => ({ tabId: peerTabId, session }))
    : []
  return { ...source, peers }
}
