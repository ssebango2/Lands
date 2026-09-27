'use client'

import { ReactNode, useEffect, useId, useRef } from 'react'

interface DialogProps {
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  /** When provided, shows a Close button and closes on Escape / backdrop click */
  onClose?: () => void
  closeLabel?: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Dialog({
  title,
  eyebrow,
  description,
  onClose,
  closeLabel = 'Close',
  actions,
  children,
  className = '',
}: DialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  // Parents pass inline callbacks; keep the latest without re-running the focus effect.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const initial =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>(FOCUSABLE)
    initial?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.stopPropagation()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  return (
    <div className="dialog-layer">
      <div className="dialog-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={`dialog-panel ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="dialog-header">
          <div className="dialog-heading">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id={titleId} className="dialog-title">{title}</h2>
            {description && (
              <p id={descriptionId} className="dialog-description">{description}</p>
            )}
          </div>
          {onClose && (
            <button type="button" className="dialog-close" onClick={onClose} aria-label={closeLabel}>
              <span className="dialog-close-icon" aria-hidden="true">×</span>
              <span className="dialog-close-text" aria-hidden="true">Close</span>
            </button>
          )}
        </header>
        {children && <div className="dialog-body">{children}</div>}
        {actions && <footer className="dialog-actions">{actions}</footer>}
      </div>
    </div>
  )
}
