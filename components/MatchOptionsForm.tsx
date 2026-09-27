'use client'

import { useId } from 'react'
import type { MatchOptions } from '@/lib/gameLogic'
import { MAX_HAND_SIZE } from '@/lib/matchRules'

interface MatchOptionsFormProps {
  value: MatchOptions
  onChange: (value: MatchOptions) => void
  disabled?: boolean
}

interface ToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  autoFocus?: boolean
}

function OptionToggle({ label, description, checked, onChange, disabled, autoFocus }: ToggleProps) {
  const descriptionId = useId()
  return (
    <label className={`option-toggle${disabled ? ' is-disabled' : ''}`}>
      <span className="option-toggle-text">
        <span className="option-toggle-label">{label}</span>
        <span className="option-toggle-description" id={descriptionId}>{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="option-switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-describedby={descriptionId}
        data-autofocus={autoFocus ? true : undefined}
      />
    </label>
  )
}

export default function MatchOptionsForm({ value, onChange, disabled }: MatchOptionsFormProps) {
  return (
    <fieldset className="match-options" disabled={disabled}>
      <legend className="visually-hidden">Game options</legend>
      <OptionToggle
        label="You go first"
        description={value.goFirst ? 'You take the first turn.' : 'Your opponent takes the first turn.'}
        checked={value.goFirst}
        onChange={(goFirst) => onChange({ ...value, goFirst })}
        disabled={disabled}
        autoFocus
      />
      <OptionToggle
        label={`${MAX_HAND_SIZE}-card hand limit`}
        description={`At the end of each turn, a player holding more than ${MAX_HAND_SIZE} cards discards down to ${MAX_HAND_SIZE}.`}
        checked={value.handLimit}
        onChange={(handLimit) => onChange({ ...value, handLimit })}
        disabled={disabled}
      />
    </fieldset>
  )
}

/** One-line summary from the point of view of `viewer` (the chooser or their opponent). */
export function describeMatchOptions(options: MatchOptions, viewerIsChooser: boolean): string {
  const viewerFirst = viewerIsChooser ? options.goFirst : !options.goFirst
  const order = viewerFirst ? 'You go first' : 'Your opponent goes first'
  const limit = options.handLimit ? `${MAX_HAND_SIZE}-card hand limit` : 'no hand limit'
  return `${order} · ${limit}`
}
