import { describe, expect, it } from 'vitest'
import { assessRepo, countByHealth, healthLabel } from './health'
import { makeRepo } from '../test/factories'

const NOW = new Date('2026-09-04T12:00:00Z')

describe('assessRepo', () => {
  it('scores a well-maintained repo as healthy', () => {
    const health = assessRepo(
      makeRepo({ updated_at: '2026-09-01T12:00:00Z', description: 'Live', topics: ['a'] }),
      NOW,
    )
    expect(health).toEqual({ level: 'healthy', score: 100, reasons: [] })
  })

  it('short-circuits an archived repo', () => {
    const health = assessRepo(makeRepo({ archived: true }), NOW)
    expect(health).toEqual({ level: 'stale', score: 0, reasons: ['Repository is archived'] })
  })

  it('penalizes an unreadable update date', () => {
    const health = assessRepo(makeRepo({ updated_at: 'nonsense' }), NOW)
    expect(health.reasons).toContain('Last update date is unreadable')
    expect(health.score).toBe(90)
  })

  it.each([
    ['2025-01-01T12:00:00Z', 'No activity for 1y', 60],
    ['2026-01-15T12:00:00Z', 'No activity for over 6 months', 75],
    ['2026-05-01T12:00:00Z', 'No activity for over 3 months', 90],
  ])('penalizes staleness for %s', (updated, reason, score) => {
    const health = assessRepo(makeRepo({ updated_at: updated }), NOW)
    expect(health.reasons).toContain(reason)
    expect(health.score).toBe(score)
  })

  it('penalizes a missing description', () => {
    expect(assessRepo(makeRepo({ description: null }), NOW).reasons).toContain('No description')
    expect(assessRepo(makeRepo({ description: '   ' }), NOW).reasons).toContain('No description')
  })

  it('penalizes missing topics', () => {
    expect(assessRepo(makeRepo({ topics: [] }), NOW).reasons).toContain('No topics')
  })

  it('penalizes a large issue backlog', () => {
    const health = assessRepo(makeRepo({ open_issues_count: 120 }), NOW)
    expect(health.reasons).toContain('120 open issues')
  })

  it('never scores below zero', () => {
    const health = assessRepo(
      makeRepo({
        updated_at: '2020-01-01T00:00:00Z',
        description: null,
        topics: [],
        open_issues_count: 500,
      }),
      NOW,
    )
    expect(health.score).toBe(20)
    expect(health.level).toBe('stale')
  })

  it('lands in the attention band between the thresholds', () => {
    const health = assessRepo(
      makeRepo({ updated_at: '2026-01-15T12:00:00Z', description: null, topics: [] }),
      NOW,
    )
    expect(health.score).toBe(50)
    expect(health.level).toBe('attention')
  })
})

describe('healthLabel', () => {
  it.each([
    ['healthy', 'Healthy'],
    ['attention', 'Needs attention'],
    ['stale', 'Stale'],
  ] as const)('labels %s', (level, expected) => {
    expect(healthLabel(level)).toBe(expected)
  })
})

describe('countByHealth', () => {
  it('tallies each level', () => {
    const counts = countByHealth(
      [
        makeRepo({ id: 1, updated_at: '2026-09-01T12:00:00Z' }),
        makeRepo({ id: 2, updated_at: '2026-01-15T12:00:00Z', description: null, topics: [] }),
        makeRepo({ id: 3, archived: true }),
      ],
      NOW,
    )
    expect(counts).toEqual({ healthy: 1, attention: 1, stale: 1 })
  })

  it('returns zeros for an empty list', () => {
    expect(countByHealth([], NOW)).toEqual({ healthy: 0, attention: 0, stale: 0 })
  })
})
