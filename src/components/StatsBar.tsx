import { compactNumber } from '../lib/format'
import { summarizeRepos } from '../lib/format'
import type { GitHubRepo } from '../lib/types'

export function StatsBar({ repos }: { repos: GitHubRepo[] }) {
  const stats = summarizeRepos(repos)
  if (stats.total === 0) return null

  return (
    <dl className="stats" role="group" aria-label="Repository statistics">
      <div>
        <dt>Repos</dt>
        <dd>{stats.total}</dd>
      </div>
      <div>
        <dt>Stars</dt>
        <dd>{compactNumber(stats.stars)}</dd>
      </div>
      <div>
        <dt>Forks</dt>
        <dd>{compactNumber(stats.forks)}</dd>
      </div>
      <div>
        <dt>Open issues</dt>
        <dd>{compactNumber(stats.openIssues)}</dd>
      </div>
      <div>
        <dt>Languages</dt>
        <dd>{stats.languages.length === 0 ? '—' : stats.languages.join(', ')}</dd>
      </div>
    </dl>
  )
}
