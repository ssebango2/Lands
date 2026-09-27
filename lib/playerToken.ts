/** Per-tab seat tokens: reloading a tab reclaims its seat, a second tab gets its own. */

const keyFor = (code: string) => `lands:seat:${code.toUpperCase()}`

export function createPlayerToken(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function savePlayerToken(code: string, token: string) {
  sessionStorage.setItem(keyFor(code), token)
}

export function getPlayerToken(code: string): string {
  let token = sessionStorage.getItem(keyFor(code))
  if (!token) {
    token = createPlayerToken()
    savePlayerToken(code, token)
  }
  return token
}
