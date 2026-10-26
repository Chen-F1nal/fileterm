import { useRef, type ReactNode } from 'react'
import { VerticalScrollbar } from '../../../features/common/vertical-scrollbar'
import './form-dialog.css'

/** Shares framed form spacing without changing each modal's submission or dismissal behavior. */
export function FormDialogBody({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  return (
    <div className="form-dialog__scroll-region">
      <div className="form-dialog__body" ref={scrollRef}>
        {children}
      </div>
      <VerticalScrollbar scrollRef={scrollRef} />
    </div>
  )
}
