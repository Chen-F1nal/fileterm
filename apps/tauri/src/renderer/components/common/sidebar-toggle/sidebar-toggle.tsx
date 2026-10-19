import { Button } from '../button/button'
import './sidebar-toggle.css'

export function SidebarToggle({ collapsed, label, onClick }: { collapsed: boolean; label: string; onClick(): void }) {
  return (
    <Button
      aria-label={label}
      aria-expanded={!collapsed}
      className="sidebar-toggle"
      title={label}
      onClick={onClick}
      icon={<span className="sidebar-toggle-icon" aria-hidden="true" />}
    />
  )
}
