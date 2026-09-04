import { describe, expect, it } from 'vitest'
import {
  compactNumber,
  filterRepos,
  looksLikeToken,
  maskToken,
  parseTopics,
  relativeTime,
  sortRepos,
  summarizeRepos,
} from './format'
import { makeRepo } from '../test/factories'

describe('looksLikeToken', () => {
  it('accepts classic and fine-grained tokens', () => {
    expect(looksLikeToken('ghp_' + 'a'.repeat(36))).toBe(true)
    expect(looksLikeToken('gho_' + 'b'.repeat(36))).toBe(true)
    expect(looksLikeToken('github_pat_' + 'c'.repeat(40))).toBe(true)
  })

  it('rejects short or malformed values', () => {
    expect(looksLikeToken('')).toBe(false)
    expect(looksLikeToken('ghp_short')).toBe(false)
    expect(looksLikeToken('not-a-token-but-long-enough-string')).toBe(false)
  })

  it('ignores surrounding whitespace', () => {
    expect(looksLikeToken('  ghp_' + 'a'.repeat(36) + '  ')).toBe(true)
  })
})

describe('maskToken', () => {
  it('masks the middle of a long token', () => {
    expect(maskToken('ghp_abcdefghijkl')).toBe('ghp_••••••ijkl')
  })

  it('fully masks a short value', () => {
    expect(maskToken('abcd')).toBe('••••')
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-09-04T12:00:00Z')

  it.each([
    ['2026-09-04T11:59:30Z', 'just now'],
    ['2026-09-04T11:30:00Z', '30m ago'],
    ['2026-09-04T06:00:00Z', '6h ago'],
    ['2026-09-01T12:00:00Z', '3d ago'],
    ['2026-06-04T12:00:00Z', '3mo ago'],
    ['2024-09-04T12:00:00Z', '2y ago'],
  ])('formats %s as %s', (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected)
  })

  it('handles an unparseable date', () => {
    expect(relativeTime('not-a-date', now)).toBe('unknown')
  })
})

describe('compactNumber', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1500, '1.5k'],
    [24000, '24k'],
    [2_400_000, '2.4M'],
  ])('formats %i as %s', (input, expected) => {
    expect(compactNumber(input)).toBe(expected)
  })
})

describe('parseTopics', () => {
  it('splits, lowercases and dedupes', () => {
    expect(parseTopics('React, react  TypeScript,,vite')).toEqual([
      'react',
      'typescript',
      'vite',
    ])
  })

  it('returns an empty list for blank input', () => {
    expect(parseTopics('   ')).toEqual([])
  })
})

describe('filterRepos', () => {
  const repos = [
    makeRepo({ id: 1, name: 'infra', language: 'HCL', topics: ['terraform'] }),
    makeRepo({ id: 2, name: 'web', language: 'TypeScript', description: 'The site', topics: [] }),
    makeRepo({ id: 3, name: 'docs', language: null, description: null, topics: ['guides'] }),
  ]

  it('returns everything for an empty query', () => {
    expect(filterRepos(repos, '  ')).toHaveLength(3)
  })

  it('matches name, language, description and topics', () => {
    expect(filterRepos(repos, 'infra').map((r) => r.id)).toEqual([1])
    expect(filterRepos(repos, 'typescript').map((r) => r.id)).toEqual([2])
    expect(filterRepos(repos, 'the site').map((r) => r.id)).toEqual([2])
    expect(filterRepos(repos, 'guides').map((r) => r.id)).toEqual([3])
  })

  it('returns nothing when there is no match', () => {
    expect(filterRepos(repos, 'zzz')).toEqual([])
  })
})

describe('sortRepos', () => {
  const repos = [
    makeRepo({ id: 1, name: 'beta', stargazers_count: 5, updated_at: '2026-01-01T00:00:00Z' }),
    makeRepo({ id: 2, name: 'alpha', stargazers_count: 50, updated_at: '2026-06-01T00:00:00Z' }),
    makeRepo({ id: 3, name: 'gamma', stargazers_count: 1, updated_at: '2026-03-01T00:00:00Z' }),
  ]

  it('sorts by stars', () => {
    expect(sortRepos(repos, 'stars').map((r) => r.id)).toEqual([2, 1, 3])
  })

  it('sorts by name', () => {
    expect(sortRepos(repos, 'name').map((r) => r.id)).toEqual([2, 1, 3])
  })

  it('sorts by updated date', () => {
    expect(sortRepos(repos, 'updated').map((r) => r.id)).toEqual([2, 3, 1])
  })

  it('does not mutate the input', () => {
    const before = repos.map((r) => r.id)
    sortRepos(repos, 'stars')
    expect(repos.map((r) => r.id)).toEqual(before)
  })
})

describe('summarizeRepos', () => {
  it('totals counts and collects languages', () => {
    const stats = summarizeRepos([
      makeRepo({ id: 1, stargazers_count: 2, forks_count: 1, open_issues_count: 3, language: 'Go' }),
      makeRepo({ id: 2, stargazers_count: 8, forks_count: 4, open_issues_count: 0, language: 'Go' }),
      makeRepo({ id: 3, stargazers_count: 0, forks_count: 0, open_issues_count: 1, language: null }),
    ])
    expect(stats).toEqual({
      total: 3,
      stars: 10,
      forks: 5,
      openIssues: 4,
      languages: ['Go'],
    })
  })

  it('handles an empty list', () => {
    expect(summarizeRepos([])).toEqual({
      total: 0,
      stars: 0,
      forks: 0,
      openIssues: 0,
      languages: [],
    })
  })
})
