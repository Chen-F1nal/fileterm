import type { ConnectionProfile, ProxyConfig, SshProfile } from '@fileterm/core'

export type SshJumpRouteError = 'cycle' | 'missing' | 'type' | 'too-long' | 'proxy-conflict'

export function resolveSshJumpRoute(
  target: { id?: string; jumpProfileId?: string; proxy?: ProxyConfig; proxyProfileId?: string },
  profiles: ConnectionProfile[]
): { jumpHosts: SshProfile[]; error: SshJumpRouteError | null } {
  const jumpHosts: SshProfile[] = []
  const visited = new Set(target.id ? [target.id] : [])
  let current = target
  while (current.jumpProfileId) {
    if (current.proxyProfileId || (current.proxy?.type && current.proxy.type !== 'none')) {
      return { jumpHosts: [], error: 'proxy-conflict' }
    }
    const id = current.jumpProfileId
    if (visited.has(id)) return { jumpHosts: [], error: 'cycle' }
    if (jumpHosts.length >= 8) return { jumpHosts: [], error: 'too-long' }
    visited.add(id)
    const hop = profiles.find((profile) => profile.id === id)
    if (!hop) return { jumpHosts: [], error: 'missing' }
    if (hop.type !== 'ssh') return { jumpHosts: [], error: 'type' }
    jumpHosts.push(hop)
    current = hop
  }
  return { jumpHosts: jumpHosts.reverse(), error: null }
}
