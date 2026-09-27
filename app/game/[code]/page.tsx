'use client'

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { GameState, MatchOptions, RematchState, TargetedEffect } from '@/lib/gameLogic'
import { MAX_HAND_SIZE } from '@/lib/matchRules'
import { getPlayerToken } from '@/lib/playerToken'
import { useSocket } from '@/lib/useSocket'
import { useGame } from '@/lib/useGame'
import { shouldPlayOpeningIntro, useGameIntro } from '@/lib/useGameIntro'
import { motionViewsFromGameState } from '@/lib/cardMotion'
import { useCardMotion } from '@/lib/useCardMotion'
import PlayerSection from '@/components/PlayerSection'
import GameLog from '@/components/GameLog'
import Board from '@/components/Board'
import Dialog from '@/components/Dialog'
import IslandDecision from '@/components/IslandDecision'
import CardMotionLayer from '@/components/CardMotionLayer'
import MatchOptionsForm, { describeMatchOptions } from '@/components/MatchOptionsForm'

interface RematchPayload {
  rematch: RematchState
  matchId: number | null
  connected: { 1: boolean; 2: boolean }
}

const IDLE_REMATCH: RematchState = { status: 'idle', requestId: null, requestedBy: null, options: null, expiresAt: null, outcome: null }

function describeTarget(effect: TargetedEffect | null | undefined, me: 1 | 2 | null) {
  if (!effect) return null
  const t = effect.target
  if (!t) return 'No valid target'
  if (t.zone === 'board') return t.playerId === me ? `Your ${t.card}` : `Opponent's ${t.card}`
  return t.playerId === me ? `${t.card} from your graveyard` : `${t.card} from their graveyard`
}

function EffectPrompt({ eyebrow, title, children, tone = 'info' }: { eyebrow: string; title: string; children?: ReactNode; tone?: 'info' | 'action' }) {
  return (
    <div className={`stack-action-bar effect-prompt effect-prompt-${tone}`} role="status" aria-live="polite">
      <div className="stack-info">
        <span className="eyebrow">{eyebrow}</span>
        <span className="stack-spell">{title}</span>
      </div>
      {children}
    </div>
  )
}

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const { socket, isConnected } = useSocket()

  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<1 | 2 | null>(null)
  const [waitingForPlayer, setWaitingForPlayer] = useState(false)
  const [expandedGraveyard, setExpandedGraveyard] = useState<1 | 2 | null>(null)
  const [isGameLogOpen, setIsGameLogOpen] = useState(false)
  const [undoRequestFrom, setUndoRequestFrom] = useState<1 | 2 | null>(null)
  const [forestReveal, setForestReveal] = useState<{ playerId: 1 | 2; cardIndex: number } | null>(null)
  const [introSession, setIntroSession] = useState(0)
  const [codeCopied, setCodeCopied] = useState(false)
  const [rematch, setRematch] = useState<RematchState>(IDLE_REMATCH)
  /** Options being chosen before sending a rematch request; null while not choosing. */
  const [rematchDraft, setRematchDraft] = useState<MatchOptions | null>(null)
  const [seatsOnline, setSeatsOnline] = useState<{ 1: boolean; 2: boolean }>({ 1: true, 2: true })
  const [notice, setNotice] = useState<string | null>(null)

  const {
    activePlayer,
    gameLog,
    targetedEffect,
    mountainTargetSelection,
    forestTargetSelection,
    swampSelection,
    islandSelection,
    handLimitSelection,
    stack,
    priorityHolder,
    autoPass,
    canPayCounterCost,
    handlePlayCard,
    handleMountainTarget,
    handleForestTarget,
    handleSwampReveal,
    handleSwampDiscard,
    handleIslandChoice,
    handleHandLimitDiscard,
    handlePass,
    handleCounter,
    setAutoPass,
  } = useGame({ socket, playerId, gameState })

  const playIntro = useMemo(
    () => (gameState ? shouldPlayOpeningIntro(gameState) : false),
    [gameState]
  )

  const {
    phase: introPhase,
    displayDeckCount,
    displayHandCount,
    isIntroActive,
    isInteractive,
    skip: skipIntro,
  } = useGameIntro(playIntro, playIntro ? `${code}-${introSession}` : null)

  const motionViews = useMemo(() => (gameState ? motionViewsFromGameState(gameState) : null), [gameState])
  const faceUpHands = useMemo(() => ({ 1: playerId === 1, 2: playerId === 2 }), [playerId])
  const { flights, holds, finishFlight } = useCardMotion({
    views: motionViews,
    resetKey: `${gameState?.matchId ?? 0}-${introSession}`,
    enabled: !isIntroActive,
    faceUpHands,
  })

  const introProps = isIntroActive
    ? {
        introHandCount: displayHandCount,
        introDeckCount: displayDeckCount,
        isShuffling: introPhase === 'shuffle',
        isIntroDealing: introPhase === 'dealing',
      }
    : {}

  const canAct = isInteractive

  useEffect(() => {
    if (!socket || !isConnected) return

    socket.emit('game:join', { code, playerToken: getPlayerToken(code) })

    socket.on('game:joined', (data: { playerId: 1 | 2; players: number }) => {
      setPlayerId(data.playerId)
      setWaitingForPlayer(data.players < 2)
    })

    socket.on('game:player-joined', (data: { players: number }) => {
      setWaitingForPlayer(data.players < 2)
    })

    socket.on('game:start', (data: { gameState: GameState }) => {
      setIntroSession((n) => n + 1)
      setGameState(data.gameState)
      setWaitingForPlayer(false)
      setExpandedGraveyard(null)
      setForestReveal(null)
      setUndoRequestFrom(null)
      setNotice(null)
      setRematchDraft(null)
    })

    socket.on('game:state', (data: { gameState: GameState }) => {
      setGameState(data.gameState)
      setWaitingForPlayer(false)
    })

    socket.on('game:rematch', (data: RematchPayload) => {
      setRematch(data.rematch ?? IDLE_REMATCH)
      if (data.connected) setSeatsOnline(data.connected)
    })

    socket.on('game:player-left', (data: { playerId: 1 | 2 }) => {
      setSeatsOnline((s) => ({ ...s, [data.playerId]: false }))
    })

    socket.on('game:player-reconnected', (data: { playerId: 1 | 2 }) => {
      setSeatsOnline((s) => ({ ...s, [data.playerId]: true }))
    })

    socket.on('game:action-error', (data: { error: string }) => {
      setNotice(data.error)
    })

    socket.on('game:rematch-error', (data: { error: string }) => {
      setNotice(data.error)
    })

    socket.on('game:join-error', (data: { error: string }) => {
      alert(data.error)
      router.push('/lobby')
    })

    socket.on('game:undo-requested', (data: { fromPlayerId: 1 | 2 }) => {
      setUndoRequestFrom(data.fromPlayerId)
    })

    socket.on('game:undo-declined', () => {
      setUndoRequestFrom(null)
    })

    return () => {
      socket.off('game:joined')
      socket.off('game:player-joined')
      socket.off('game:start')
      socket.off('game:state')
      socket.off('game:rematch')
      socket.off('game:player-left')
      socket.off('game:player-reconnected')
      socket.off('game:action-error')
      socket.off('game:rematch-error')
      socket.off('game:join-error')
      socket.off('game:undo-requested')
      socket.off('game:undo-declined')
    }
  }, [socket, isConnected, code, router])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  // Forest resolved: show the returned card face-up until its owner's opponent acts
  const lastEffect = gameState?.lastEffect
  const seenEffectRef = useRef<string | null>(null)
  useEffect(() => {
    if (!lastEffect || lastEffect.phase !== 'EFFECT_COMPLETE') return
    const key = `${gameState?.matchId}-${lastEffect.id}`
    if (seenEffectRef.current === key) return
    seenEffectRef.current = key
    if (lastEffect.spell === 'Forest' && lastEffect.outcome === 'resolved' && lastEffect.returnedIndex != null) {
      setForestReveal({ playerId: lastEffect.controller, cardIndex: lastEffect.returnedIndex })
    }
  }, [lastEffect, gameState?.matchId])

  const copyCode = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 1600)
    })
  }

  if (waitingForPlayer) {
    return (
      <div className="container">
        <main className="waiting-screen">
          <p className="eyebrow">Game created</p>
          <h1>Waiting for an opponent</h1>
          <p>Share this code so they can join from the lobby.</p>
          <div className="waiting-code-box">
            <strong className="waiting-code-text" aria-label={`Game code ${code.split('').join(' ')}`}>{code}</strong>
            <button type="button" className="btn btn-secondary btn-small btn-copy-code" onClick={copyCode}>
              {codeCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="waiting-spinner" role="status" aria-label="Waiting for opponent"></div>
          <Link href="/lobby" className="btn btn-ghost waiting-back-btn">
            Back to lobby
          </Link>
        </main>
      </div>
    )
  }

  if (!gameState || !playerId) {
    return (
      <div className="container">
        <main className="waiting-screen">
          <div className="waiting-spinner" aria-hidden="true"></div>
          <h1>Loading game…</h1>
        </main>
      </div>
    )
  }

  const opponentId: 1 | 2 = playerId === 1 ? 2 : 1
  const opponentOnline = seatsOnline[opponentId]
  const isMyTurn = activePlayer === playerId
  const stackTop = stack.length > 0 ? stack[stack.length - 1] : null
  const ownerLabel = (id: 1 | 2) => (id === playerId ? 'You' : 'Opponent')
  const noPendingWork = !targetedEffect && !swampSelection && !islandSelection && !handLimitSelection && stack.length === 0
  const discardingToLimit = canAct && handLimitSelection?.playerId === playerId
  const lockedTarget = targetedEffect?.phase === 'AWAITING_COUNTER_DECISION' ? targetedEffect.target : null
  const boardTarget = (id: 1 | 2) => (lockedTarget?.zone === 'board' && lockedTarget.playerId === id ? lockedTarget.card : undefined)
  const graveyardTarget = (id: 1 | 2) => (lockedTarget?.zone === 'graveyard' && lockedTarget.playerId === id ? lockedTarget.card : undefined)
  const pendingCardFor = (id: 1 | 2) => {
    if (stackTop?.controller === id) return stackTop.spell
    if (targetedEffect?.controller === id && targetedEffect.phase === 'AWAITING_TARGET_SELECTION') return targetedEffect.spell
    return undefined
  }
  const choosingMountainTarget = canAct && mountainTargetSelection?.activePlayer === playerId
  const choosingForestTarget = canAct && forestTargetSelection?.activePlayer === playerId

  const renderPrompt = () => {
    if (!canAct || gameState.winner) return null
    if (targetedEffect?.phase === 'AWAITING_TARGET_SELECTION') {
      if (targetedEffect.controller === playerId) {
        const isMountain = targetedEffect.spell === 'Mountain'
        return (
          <EffectPrompt tone="action" eyebrow={`Your ${targetedEffect.spell}`} title="Select a target">
            <p className="stack-question">
              {isMountain
                ? "Choose one of your opponent's lands to destroy."
                : 'Choose a card from your graveyard to return to your hand.'}
            </p>
            <p className="stack-note">Your opponent may respond after you lock in a target.</p>
            {!isMountain && (
              <div className="stack-buttons">
                <button type="button" className="btn btn-primary" onClick={() => setExpandedGraveyard(playerId)}>
                  Choose from graveyard
                </button>
              </div>
            )}
          </EffectPrompt>
        )
      }
      return (
        <EffectPrompt eyebrow={`Opponent's ${targetedEffect.spell}`} title="Choosing a target…">
          <p className="stack-note">You can respond once their target is locked in.</p>
        </EffectPrompt>
      )
    }

    if (stackTop) {
      const effect = stackTop.effectId != null && targetedEffect?.id === stackTop.effectId ? targetedEffect : null
      const target = describeTarget(effect, playerId)
      const spellLabel = `${stackTop.controller === playerId ? 'Your' : "Opponent's"} ${stackTop.spell}`
      const countered = stackTop.counterCount > 0 ? ` · countered ×${stackTop.counterCount}` : ''
      if (priorityHolder === playerId) {
        const canCounter = canPayCounterCost(gameState.players[playerId - 1], stackTop.spell, stackTop.counterCount)
        return (
          <div className="stack-action-bar effect-prompt-action" role="group" aria-labelledby="counter-prompt-text">
            <div className="stack-info" id="counter-prompt-text">
              <span className="eyebrow">Respond{countered}</span>
              <span className="stack-spell">{spellLabel}</span>
              {target && <span className="stack-target">Target: {target}</span>}
              <span className="stack-question">
                {stackTop.controller === playerId ? 'Counter their counter?' : 'Counter it?'}
              </span>
            </div>
            <div className="stack-buttons">
              <button type="button" className="btn btn-secondary" onClick={() => { setForestReveal(null); handlePass() }}>
                Pass
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canCounter}
                aria-describedby={canCounter ? undefined : 'counter-cost-note'}
                onClick={() => { setForestReveal(null); handleCounter() }}
              >
                Counter
              </button>
            </div>
            {!canCounter && (
              <p className="stack-note counter-cost-note" id="counter-cost-note">
                {stackTop.counterCount === 0 && stackTop.spell !== 'Island'
                  ? `Countering needs an Island and a ${stackTop.spell} in hand.`
                  : 'Countering needs two Islands in hand.'}
              </p>
            )}
          </div>
        )
      }
      if (priorityHolder === opponentId) {
        return (
          <EffectPrompt eyebrow={`Waiting on opponent${countered}`} title={spellLabel}>
            {target && <span className="stack-target">Target: {target}</span>}
            <p className="stack-note">Your opponent is deciding whether to counter.</p>
          </EffectPrompt>
        )
      }
    }

    if (handLimitSelection) {
      const count = handLimitSelection.discardCount
      const cards = `${count} card${count === 1 ? '' : 's'}`
      if (handLimitSelection.playerId === playerId) {
        return (
          <EffectPrompt tone="action" eyebrow="Hand limit" title={`Discard ${cards}`}>
            <p className="stack-question">
              You have more than {MAX_HAND_SIZE} cards. Choose cards from your hand to discard down to {MAX_HAND_SIZE}.
            </p>
          </EffectPrompt>
        )
      }
      return (
        <EffectPrompt eyebrow="Hand limit" title="Opponent is discarding…">
          <p className="stack-note">They must discard {cards} to get down to {MAX_HAND_SIZE}.</p>
        </EffectPrompt>
      )
    }

    if (islandSelection && islandSelection.activePlayer === opponentId) {
      return (
        <EffectPrompt eyebrow="Opponent's Island" title="Deciding…">
          <p className="stack-note">They are choosing whether to keep their revealed card.</p>
        </EffectPrompt>
      )
    }
    return null
  }

  const renderRematch = () => {
    const opponentName = `Player ${opponentId}`
    const optionsSummary = (viewerIsChooser: boolean) =>
      rematch.options && (
        <p className="rematch-options-summary">{describeMatchOptions(rematch.options, viewerIsChooser)}</p>
      )
    if (rematch.status === 'requested' && rematch.requestedBy === playerId) {
      return (
        <>
          <p className="rematch-status" role="status">Rematch requested… waiting for {opponentName}.</p>
          {optionsSummary(true)}
          <div className="dialog-actions-inline">
            <Link href="/lobby" className="btn btn-ghost">Back to lobby</Link>
            <button type="button" className="btn btn-secondary" autoFocus onClick={() => socket?.emit('game:rematch', { action: 'cancel', requestId: rematch.requestId })}>
              Cancel request
            </button>
          </div>
        </>
      )
    }
    if (rematch.status === 'requested') {
      return (
        <>
          <p className="rematch-status rematch-status-incoming" role="status">{opponentName} wants a rematch.</p>
          {optionsSummary(false)}
          <div className="dialog-actions-inline">
            <button type="button" className="btn btn-secondary" onClick={() => socket?.emit('game:rematch', { action: 'decline', requestId: rematch.requestId })}>
              Decline
            </button>
            <button type="button" className="btn btn-primary" data-autofocus autoFocus onClick={() => socket?.emit('game:rematch', { action: 'accept', requestId: rematch.requestId })}>
              Accept
            </button>
          </div>
        </>
      )
    }
    const outcomeText: Record<string, string> = {
      declined: 'The rematch was declined.',
      cancelled: 'The rematch request was cancelled.',
      expired: 'The rematch request expired.',
      disconnected: 'Rematch cancelled: a player disconnected.',
      unavailable: 'Your opponent is not connected.',
    }
    const status = !opponentOnline ? `${opponentName} is offline.` : rematch.outcome ? outcomeText[rematch.outcome] : null
    if (rematchDraft) {
      return (
        <>
          <p className="rematch-status">Choose options for the rematch. {opponentName} will see them before accepting.</p>
          <MatchOptionsForm value={rematchDraft} onChange={setRematchDraft} />
          {!opponentOnline && <p className="rematch-status" role="status">{status}</p>}
          <div className="dialog-actions-inline">
            <button type="button" className="btn btn-secondary" onClick={() => setRematchDraft(null)}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!opponentOnline}
              onClick={() => {
                socket?.emit('game:rematch', { action: 'request', options: rematchDraft })
                setRematchDraft(null)
              }}
            >
              Send request
            </button>
          </div>
        </>
      )
    }
    return (
      <>
        {status && <p className="rematch-status" role="status">{status}</p>}
        <div className="dialog-actions-inline">
          <Link href="/lobby" className="btn btn-ghost">Back to lobby</Link>
          <button
            type="button"
            className="btn btn-primary"
            data-autofocus
            autoFocus
            disabled={!opponentOnline}
            onClick={() =>
              setRematchDraft({
                // Default to alternating: whoever didn't start this match starts the next.
                goFirst: gameState.startingPlayer !== playerId,
                handLimit: !!gameState.rules?.handLimit,
              })
            }
          >
            Request rematch
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="container">
      {gameState.winner && (
        <Dialog
          className="game-over-dialog"
          eyebrow="Game over"
          title={gameState.winner === playerId ? 'You win' : `Player ${gameState.winner} wins`}
          description={gameState.winReason ?? undefined}
        >
          <div className="rematch-panel">{renderRematch()}</div>
        </Dialog>
      )}
      {isIntroActive && (
        <div className="game-intro-banner" aria-live="polite">
          <div className="game-intro-banner-label">
            {introPhase === 'shuffle' ? 'Shuffling decks…' : 'Drawing opening hands…'}
          </div>
          <button type="button" className="btn-skip-intro" onClick={skipIntro}>
            Skip
          </button>
        </div>
      )}
      <div className={`game-board${isIntroActive ? ' intro-locked' : ''}`}>
        <aside className="table-rail table-rail-left" aria-label="Game information">
          <div className="game-header">
            <div className="game-meta">
              <span className="eyebrow">Game code</span>
              <span className="game-code-display">{code}</span>
            </div>
            <div className="game-meta">
              <span className="eyebrow">You are</span>
              <span className={`player-indicator player-indicator-p${playerId}`}>Player {playerId}</span>
            </div>
            {gameState.rules?.handLimit && (
              <span className="match-rules-note">{MAX_HAND_SIZE}-card hand limit</span>
            )}
            <div
              className={`connection-status ${isConnected ? 'is-connected' : 'is-disconnected'}`}
              role="status"
            >
              <span className="connection-dot" aria-hidden="true" />
              {isConnected ? 'Connected' : 'Reconnecting…'}
            </div>
            {!opponentOnline && (
              <div className="connection-status is-disconnected" role="status">
                <span className="connection-dot" aria-hidden="true" />
                Opponent offline
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-game-log-toggle"
            onClick={() => setIsGameLogOpen(!isGameLogOpen)}
            aria-expanded={isGameLogOpen}
            aria-controls="game-log-panel"
          >
            Game log
          </button>
        </aside>

        <PlayerSection
          player={gameState.players[1]}
          playerId={2}
          isActive={activePlayer === 2}
          isOpponent={playerId !== 2}
          atBottom={playerId === 2}
          canPlayCard={canAct && activePlayer === 2 && noPendingWork}
          onPlayCard={(cardIndex) => { setForestReveal(null); handlePlayCard(2, cardIndex) }}
          forestRevealedCardIndex={forestReveal?.playerId === 2 ? forestReveal.cardIndex : undefined}
          onGraveyardCardClick={choosingForestTarget && playerId === 2
            ? (cardIndex) => {
                handleForestTarget(2, cardIndex)
                setExpandedGraveyard(null)
              }
            : undefined}
          isGraveyardSelectable={choosingForestTarget && playerId === 2}
          isGraveyardExpanded={expandedGraveyard === 2}
          onToggleGraveyard={() => setExpandedGraveyard(expandedGraveyard === 2 ? null : 2)}
          graveyardTarget={graveyardTarget(2)}
          onSwampReveal={swampSelection && swampSelection.phase === 'reveal' && swampSelection.activePlayer === 1
            ? (cardIndex) => handleSwampReveal(2, cardIndex)
            : undefined}
          onSwampDiscard={swampSelection && swampSelection.phase === 'discard' && swampSelection.activePlayer === 1
            ? (cardIndex) => handleSwampDiscard(2, cardIndex)
            : undefined}
          swampRevealedCards={swampSelection && swampSelection.activePlayer === 1
            ? (playerId === 1 && swampSelection.phase === 'reveal'
                ? []
                : swampSelection.revealedCards)
            : []}
          swampPhase={swampSelection && swampSelection.activePlayer === 1
            ? swampSelection.phase
            : null}
          onHandLimitDiscard={discardingToLimit && playerId === 2 ? handleHandLimitDiscard : undefined}
          motionHolds={holds[2]}
          {...introProps}
        />
        <div className={`board-area ${playerId === 2 ? 'perspective-player2' : ''}`}>
          <Board
            cards={gameState.players[1].board}
            playerId={2}
            label={ownerLabel(2)}
            onCardClick={choosingMountainTarget && playerId === 1
              ? (cardIndex) => handleMountainTarget(2, cardIndex)
              : undefined}
            isSelectable={choosingMountainTarget && playerId === 1}
            pendingCard={pendingCardFor(2)}
            targetedCard={boardTarget(2)}
          />
          <div className="combat-zone" aria-hidden="true" />
          <Board
            cards={gameState.players[0].board}
            playerId={1}
            label={ownerLabel(1)}
            onCardClick={choosingMountainTarget && playerId === 2
              ? (cardIndex) => handleMountainTarget(1, cardIndex)
              : undefined}
            isSelectable={choosingMountainTarget && playerId === 2}
            pendingCard={pendingCardFor(1)}
            targetedCard={boardTarget(1)}
          />
        </div>
        <PlayerSection
          player={gameState.players[0]}
          playerId={1}
          isActive={activePlayer === 1}
          isOpponent={playerId !== 1}
          atBottom={playerId === 1}
          canPlayCard={canAct && activePlayer === 1 && noPendingWork}
          onPlayCard={(cardIndex) => { setForestReveal(null); handlePlayCard(1, cardIndex) }}
          forestRevealedCardIndex={forestReveal?.playerId === 1 ? forestReveal.cardIndex : undefined}
          onGraveyardCardClick={choosingForestTarget && playerId === 1
            ? (cardIndex) => {
                handleForestTarget(1, cardIndex)
                setExpandedGraveyard(null)
              }
            : undefined}
          isGraveyardSelectable={choosingForestTarget && playerId === 1}
          isGraveyardExpanded={expandedGraveyard === 1}
          onToggleGraveyard={() => setExpandedGraveyard(expandedGraveyard === 1 ? null : 1)}
          graveyardTarget={graveyardTarget(1)}
          onSwampReveal={swampSelection && swampSelection.phase === 'reveal' && swampSelection.activePlayer === 2
            ? (cardIndex) => handleSwampReveal(1, cardIndex)
            : undefined}
          onSwampDiscard={swampSelection && swampSelection.phase === 'discard' && swampSelection.activePlayer === 2
            ? (cardIndex) => handleSwampDiscard(1, cardIndex)
            : undefined}
          swampRevealedCards={swampSelection && swampSelection.activePlayer === 2
            ? (playerId === 2 && swampSelection.phase === 'reveal'
                ? []
                : swampSelection.revealedCards)
            : []}
          swampPhase={swampSelection && swampSelection.activePlayer === 2
            ? swampSelection.phase
            : null}
          onHandLimitDiscard={discardingToLimit && playerId === 1 ? handleHandLimitDiscard : undefined}
          motionHolds={holds[1]}
          {...introProps}
        />

        <aside className="table-rail table-rail-right" aria-label="Turn">
          <div className="turn-and-counter-panel">
            {renderPrompt()}
            {notice && <p className="table-notice" role="alert">{notice}</p>}
            <div
              key={activePlayer}
              className={`turn-indicator turn-indicator-p${activePlayer}${isMyTurn ? ' is-you' : ''}`}
              role="status"
              aria-live="polite"
            >
              <span className="eyebrow turn-indicator-eyebrow">Current turn</span>
              <span className="turn-indicator-label">{isMyTurn ? 'Your turn' : "Opponent's turn"}</span>
              <span className="turn-indicator-player">Player {activePlayer}</span>
            </div>
            <label className="counter-toggle-label" title="Automatically pass whenever you could counter a spell">
              <input
                type="checkbox"
                checked={autoPass}
                onChange={(e) => setAutoPass(e.target.checked)}
              />
              <span>Auto-pass counters</span>
            </label>
          </div>
        </aside>
      </div>

      <CardMotionLayer flights={flights} onDone={finishFlight} />

      {isGameLogOpen && (
        <div
          className="game-log-backdrop"
          onClick={() => setIsGameLogOpen(false)}
        />
      )}
      <div
        id="game-log-panel"
        className={`game-log-sidebar ${isGameLogOpen ? 'open' : ''}`}
        role="region"
        aria-label="Game log"
      >
        <div className="game-log-header">
          <h3>Game log</h3>
          <button
            type="button"
            className="dialog-close btn-close-log"
            onClick={() => setIsGameLogOpen(false)}
            aria-label="Close game log"
          >
            <span className="dialog-close-icon" aria-hidden="true">×</span>
            <span className="dialog-close-text" aria-hidden="true">Close</span>
          </button>
        </div>
        <GameLog logs={gameLog} />
      </div>

      {undoRequestFrom && (
        <Dialog
          eyebrow="Request"
          title="Undo last action?"
          description={`Player ${undoRequestFrom} asked to undo their last action.`}
          actions={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  socket?.emit('game:undo-decline')
                  setUndoRequestFrom(null)
                }}
              >
                Decline
              </button>
              <button
                type="button"
                className="btn btn-primary"
                data-autofocus
                onClick={() => {
                  socket?.emit('game:undo-accept')
                  setUndoRequestFrom(null)
                }}
              >
                Accept
              </button>
            </>
          }
        />
      )}

      {canAct && islandSelection && islandSelection.activePlayer === playerId && (
        <IslandDecision
          key={`${gameState.matchId}-${gameState.turnNumber}`}
          playerId={playerId}
          revealedCard={islandSelection.revealedCard}
          onChoose={handleIslandChoice}
        />
      )}
    </div>
  )
}
