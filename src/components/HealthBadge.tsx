import { assessRepo, healthLabel } from '../lib/health'
import type { GitHubRepo } from '../lib/types'

export function HealthBadge({ repo }: { repo: GitHubRepo }) {
  const health = assessRepo(repo)
  const title = health.reasons.length > 0 ? health.reasons.join(' · ') : 'No issues detected'

  return (
    <span
      className={`health health-${health.level}`}
      title={title}
      aria-label={`Health: ${healthLabel(health.level)}, score ${health.score}`}
    >
      {healthLabel(health.level)} · {health.score}
    </span>
  )
}
