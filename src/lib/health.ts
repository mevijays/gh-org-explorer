import type { GitHubRepo } from './types'

export type HealthLevel = 'healthy' | 'attention' | 'stale'

export interface RepoHealth {
  level: HealthLevel
  score: number
  reasons: string[]
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * A rough, deliberately simple maintenance signal for a repository.
 *
 * The score starts at 100 and loses points for the things that usually mean a
 * repo needs attention: no recent commits, a missing description, no topics,
 * and a large pile of open issues relative to its size.
 */
export function assessRepo(repo: GitHubRepo, now: Date = new Date()): RepoHealth {
  const reasons: string[] = []
  let score = 100

  if (repo.archived) {
    return { level: 'stale', score: 0, reasons: ['Repository is archived'] }
  }

  const ageDays = Math.floor((now.getTime() - new Date(repo.updated_at).getTime()) / DAY_MS)
  if (Number.isNaN(ageDays)) {
    reasons.push('Last update date is unreadable')
    score -= 10
  } else if (ageDays > 365) {
    reasons.push(`No activity for ${Math.floor(ageDays / 365)}y`)
    score -= 40
  } else if (ageDays > 180) {
    reasons.push('No activity for over 6 months')
    score -= 25
  } else if (ageDays > 90) {
    reasons.push('No activity for over 3 months')
    score -= 10
  }

  if (repo.description === null || repo.description.trim() === '') {
    reasons.push('No description')
    score -= 15
  }

  if (repo.topics.length === 0) {
    reasons.push('No topics')
    score -= 10
  }

  if (repo.open_issues_count > 50) {
    reasons.push(`${repo.open_issues_count} open issues`)
    score -= 15
  }

  score = Math.max(0, Math.min(100, score))
  const level: HealthLevel = score >= 75 ? 'healthy' : score >= 45 ? 'attention' : 'stale'
  return { level, score, reasons }
}

export function healthLabel(level: HealthLevel): string {
  switch (level) {
    case 'healthy':
      return 'Healthy'
    case 'attention':
      return 'Needs attention'
    case 'stale':
      return 'Stale'
  }
}

export function countByHealth(repos: GitHubRepo[], now: Date = new Date()): Record<HealthLevel, number> {
  const counts: Record<HealthLevel, number> = { healthy: 0, attention: 0, stale: 0 }
  for (const repo of repos) {
    counts[assessRepo(repo, now).level] += 1
  }
  return counts
}
