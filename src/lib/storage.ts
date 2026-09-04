const TOKEN_KEY = 'gh-org-explorer:token'

/**
 * `localStorage` throws in private-mode browsers and in some embedded views, so
 * every access is guarded and falls back to an in-memory value.
 */
let memoryFallback: string | null = null

export function loadToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return memoryFallback
  }
}

export function saveToken(token: string): void {
  memoryFallback = token
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Keeping the in-memory copy is the best we can do.
  }
}

export function clearToken(): void {
  memoryFallback = null
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing persisted, nothing to clear.
  }
}
