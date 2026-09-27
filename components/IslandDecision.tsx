'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { LandType } from '@/lib/gameLogic'
import { motionKey } from '@/lib/cardMotion'
import Dialog from './Dialog'
import { CARD_IMAGE } from './Card'

interface IslandDecisionProps {
  playerId: 1 | 2
  revealedCard: LandType
  eyebrow?: string
  onChoose: (choice: 'discard' | 'putBack') => void
}

/**
 * Mandatory Island choice. "Inspect board" collapses the panel into a small
 * tray (no backdrop) so the table can be read; the decision itself can only
 * be resolved from the full panel and never by Escape or a backdrop click.
 */
export default function IslandDecision({ playerId, revealedCard, eyebrow = 'Island', onChoose }: IslandDecisionProps) {
  const [inspecting, setInspecting] = useState(false)
  const returnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (inspecting) returnRef.current?.focus()
  }, [inspecting])

  if (inspecting) {
    return (
      <aside className="decision-tray" role="region" aria-label="Pending Island decision" aria-live="polite">
        <div className="decision-tray-card" data-motion={motionKey.reveal(playerId)}>
          <Image src={CARD_IMAGE[revealedCard]} alt={revealedCard} fill style={{ objectFit: 'cover' }} sizes="64px" />
        </div>
        <div className="decision-tray-text">
          <span className="eyebrow">{eyebrow} · decision pending</span>
          <span className="decision-tray-title">Revealed {revealedCard}</span>
          <span className="decision-tray-hint">Discard it or put it back on top.</span>
        </div>
        <button ref={returnRef} type="button" className="btn btn-primary btn-small" onClick={() => setInspecting(false)}>
          Return to decision
        </button>
      </aside>
    )
  }

  return (
    <Dialog
      className="reveal-dialog"
      eyebrow={eyebrow}
      title="Revealed card"
      description="This is the top card of your deck. Choose where it goes."
      actions={
        <>
          <button type="button" className="btn btn-danger btn-choice" onClick={() => onChoose('discard')}>
            <span className="btn-choice-title">Discard</span>
            <span className="btn-choice-hint">Send it to your graveyard</span>
          </button>
          <button type="button" className="btn btn-primary btn-choice" data-autofocus onClick={() => onChoose('putBack')}>
            <span className="btn-choice-title">Put Back on Top</span>
            <span className="btn-choice-hint">Keep it as your next draw</span>
          </button>
        </>
      }
    >
      <div className="reveal-body">
        <div className="reveal-card" data-motion={motionKey.reveal(playerId)}>
          <Image src={CARD_IMAGE[revealedCard]} alt={revealedCard} fill style={{ objectFit: 'cover' }} sizes="220px" />
        </div>
        <p className="reveal-card-name">{revealedCard}</p>
        <button type="button" className="btn btn-ghost btn-small btn-inspect-board" onClick={() => setInspecting(true)}>
          Inspect board
        </button>
      </div>
    </Dialog>
  )
}
