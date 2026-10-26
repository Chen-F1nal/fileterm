import { useMemo, useRef, useState, type PointerEvent, type ComponentProps, type SyntheticEvent } from 'react'
import type { RemoteFileItem } from '@fileterm/core'
import { Button } from '../../components/common/button/button'
import { DropdownSelect } from '../common/dropdown-select'
import { AppIcon } from '../common/app-icon'
import { VerticalScrollbar } from '../common/vertical-scrollbar'
import { TransferPaneContextMenu } from './transfer-pane-context-menu'
import { FileTable, PaneFilterBar, PanePathBar } from '../files/file-tables'
import type { TransferPaneState } from './use-transfer-pane'
import { matchesFileFilter, type FileFilterConfig } from '../files/file-filter'
import { nextSelection } from '../../app/app-utils'
import { t } from '../../i18n'

export function TransferPane({
  pane,
  side,
  options,
  active,
  dropTarget,
  onActivate,
  onCopy,
  onDragStart,
  contextMenuProps
}: {
  contextMenuProps: Omit<
    ComponentProps<typeof TransferPaneContextMenu>,
    'pane' | 'menu' | 'onClose' | 'copyLabel' | 'onCopyAcross'
  >
  pane: TransferPaneState
  side: 'left' | 'right'
  options: { value: string; label: string; disabled?: boolean }[]
  active: boolean
  dropTarget: boolean
  onActivate(): void
  onCopy(items: RemoteFileItem[]): void
  onDragStart(event: PointerEvent<HTMLElement>, items: RemoteFileItem[]): void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [headerContainer, setHeaderContainer] = useState<HTMLDivElement | null>(null)
  const anchor = useRef<string | null>(null)
  const [filter, setFilter] = useState<FileFilterConfig>({ query: '', mode: 'text' })
  const [menu, setMenu] = useState<{ x: number; y: number; items: RemoteFileItem[] } | null>(null)
  const rows = useMemo(
    () =>
      pane.items
        .filter((item) => matchesFileFilter(item.name, filter))
        .sort((a, b) => Number(b.type === 'folder') - Number(a.type === 'folder') || a.name.localeCompare(b.name)),
    [pane.items, filter]
  )
  const selection = pane.items.filter((item) => pane.selected.includes(item.path) && item.name !== '..')
  const activatePane = (event: SyntheticEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest('.file-transfer-pane__refresh')) return
    onActivate()
  }
  return (
    <section
      className={`file-transfer-pane ${active ? 'is-active' : ''} ${dropTarget ? 'is-drop-target' : ''}`}
      data-transfer-pane={side}
      onFocusCapture={activatePane}
      onPointerDownCapture={activatePane}
      aria-label={side === 'left' ? t.fileTransferLeft : t.fileTransferRight}
    >
      <div className="file-transfer-pane__heading">
        <DropdownSelect
          ariaLabel={side === 'left' ? t.fileTransferLeft : t.fileTransferRight}
          disabled={contextMenuProps.busy}
          value={pane.endpoint}
          options={options}
          onChange={pane.chooseEndpoint}
        />
        <Button
          className="file-transfer-pane__refresh"
          variant="ghost"
          size="compact"
          type="button"
          title={t.refresh}
          aria-label={t.refresh}
          disabled={!pane.connected || contextMenuProps.busy}
          loading={pane.loading}
          icon={<AppIcon name="refresh" />}
          onClick={() => void pane.refresh()}
        />
      </div>
      <PanePathBar
        label={t.path}
        value={pane.draftPath}
        disabled={!pane.connected || contextMenuProps.busy}
        onChange={pane.setDraftPath}
        onSubmit={(event) => {
          event.preventDefault()
          void pane.load(pane.draftPath)
        }}
      />
      <PaneFilterBar
        filter={filter}
        matchCount={rows.filter((item) => item.name !== '..').length}
        totalCount={pane.items.filter((item) => item.name !== '..').length}
        disabled={!pane.connected || contextMenuProps.busy}
        onFilterChange={setFilter}
        onClear={() => setFilter((current) => ({ ...current, query: '' }))}
      />
      {pane.error ? (
        <p className="file-transfer-error" role="alert">
          {pane.error}
        </p>
      ) : null}
      <div className="file-transfer-pane__header" ref={setHeaderContainer} />
      <div className="file-transfer-pane__list">
        <div
          ref={scrollRef}
          className="file-transfer-pane__scroll"
          tabIndex={0}
          aria-label={t.fileName}
          aria-busy={pane.loading}
          onContextMenu={(event) => {
            event.preventDefault()
            pane.setSelected([])
            setMenu({ x: event.clientX, y: event.clientY, items: [] })
          }}
          onScroll={(event) => {
            if (headerContainer) headerContainer.scrollLeft = event.currentTarget.scrollLeft
          }}
          onKeyDown={(event) => {
            const index = rows.findIndex((row) => pane.selected.includes(row.path))
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const next = Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
              const row = rows[next]
              if (row) {
                pane.setSelected([row.path])
                scrollRef.current?.scrollTo({ top: next * 24 })
              }
            } else if (event.key === 'Enter') {
              const row = rows[index]
              if (row?.type === 'folder') {
                event.preventDefault()
                void pane.load(row.path)
              }
            } else if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
              event.preventDefault()
              pane.setSelected(rows.filter((row) => row.name !== '..').map((row) => row.path))
            } else if (event.key === 'Escape') pane.setSelected([])
          }}
        >
          <FileTable
            scrollRef={scrollRef}
            headerContainer={headerContainer}
            rows={rows}
            selectedPaths={pane.selected}
            cutPaths={
              contextMenuProps.clipboard?.operation === 'cut' && contextMenuProps.clipboard.endpoint === pane.endpoint
                ? contextMenuProps.clipboard.items.map((item) => item.path)
                : undefined
            }
            emptyText={pane.loading ? t.fileTransferLoading : t.emptyFiles}
            onClearSelection={() => pane.setSelected([])}
            onOpenItem={(item) => {
              if (item.type === 'folder') void pane.load(item.path)
            }}
            onSelectItem={(event, item) => {
              if (item.name === '..') return
              pane.setSelected(
                nextSelection({
                  anchorPath: anchor.current,
                  currentSelection: pane.selected,
                  event,
                  itemPath: item.path,
                  rows: rows.filter((item) => item.name !== '..')
                })
              )
              if (!event.shiftKey) anchor.current = item.path
            }}
            onContextItem={(event, item) => {
              event.preventDefault()
              event.stopPropagation()
              if (item.name === '..') {
                pane.setSelected([])
                setMenu({ x: event.clientX, y: event.clientY, items: [] })
                return
              }
              const items = pane.selected.includes(item.path) ? selection : [item]
              pane.setSelected(items.map((item) => item.path))
              setMenu({ x: event.clientX, y: event.clientY, items })
            }}
            onPointerDragStart={(event, item) => {
              if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return
              const items = pane.selected.includes(item.path) ? selection : [item]
              pane.setSelected(items.map((item) => item.path))
              onDragStart(event, items)
            }}
          />
        </div>
        <VerticalScrollbar scrollRef={scrollRef} />
      </div>
      <footer>
        {selection.length} / {pane.items.filter((item) => item.name !== '..').length} · {pane.path}
      </footer>
      <TransferPaneContextMenu
        {...contextMenuProps}
        pane={pane}
        menu={menu}
        onClose={() => setMenu(null)}
        copyLabel={side === 'left' ? t.fileTransferCopyRight : t.fileTransferCopyLeft}
        onCopyAcross={onCopy}
      />
    </section>
  )
}
