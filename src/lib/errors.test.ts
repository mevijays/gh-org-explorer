import { describe, expect, it } from 'vitest'
import { GitHubApiError, isGitHubApiError, toMessage } from './errors'

describe('GitHubApiError', () => {
  it('carries status and url', () => {
    const error = new GitHubApiError('Bad credentials', 401, 'https://api.github.com/user')
    expect(error.name).toBe('GitHubApiError')
    expect(error.status).toBe(401)
    expect(error.url).toBe('https://api.github.com/user')
  })

  it.each([
    [401, 'not expired'],
    [403, 'required scope'],
    [404, 'lacks access'],
    [422, 'values you supplied'],
    [500, 'server error'],
    [418, 'could not be completed'],
  ])('gives a tailored hint for %i', (status, fragment) => {
    expect(new GitHubApiError('x', status, 'u').hint).toContain(fragment)
  })
})

describe('isGitHubApiError', () => {
  it('discriminates the error type', () => {
    expect(isGitHubApiError(new GitHubApiError('x', 404, 'u'))).toBe(true)
    expect(isGitHubApiError(new Error('x'))).toBe(false)
    expect(isGitHubApiError('x')).toBe(false)
  })
})

describe('toMessage', () => {
  it('combines message and hint for API errors', () => {
    const message = toMessage(new GitHubApiError('Bad credentials', 401, 'u'))
    expect(message).toContain('Bad credentials')
    expect(message).toContain('expired')
  })

  it('uses the message of a plain error', () => {
    expect(toMessage(new Error('offline'))).toBe('offline')
  })

  it('stringifies anything else', () => {
    expect(toMessage(42)).toBe('42')
  })
})
