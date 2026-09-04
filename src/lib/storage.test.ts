import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearToken, loadToken, saveToken } from './storage'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('token storage', () => {
  it('round-trips a token', () => {
    expect(loadToken()).toBeNull()
    saveToken('ghp_example')
    expect(loadToken()).toBe('ghp_example')
    clearToken()
    expect(loadToken()).toBeNull()
  })

  it('falls back to memory when localStorage throws', () => {
    saveToken('ghp_memory')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadToken()).toBe('ghp_memory')
  })

  it('does not throw when writes are blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => saveToken('ghp_blocked')).not.toThrow()
    expect(() => clearToken()).not.toThrow()
  })
})
