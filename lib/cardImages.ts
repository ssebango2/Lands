import type { LandType } from './gameLogic'

/**
 * Card art is pre-resized WebP served as-is (next.config.js disables runtime
 * image optimization). Bump the file names if the art changes, since browsers
 * cache /images/* for a week.
 */
export const CARD_IMAGE: Record<LandType, string> = {
  Plains: '/images/plains.webp',
  Island: '/images/island.webp',
  Swamp: '/images/swamp.webp',
  Mountain: '/images/mountain.webp',
  Forest: '/images/forest.webp',
}

export const CARD_BACK_IMAGE = '/images/card-back.webp'

export const ALL_CARD_IMAGES = [CARD_BACK_IMAGE, ...Object.values(CARD_IMAGE)]
