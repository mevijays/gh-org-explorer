import { compactNumber, relativeTime } from '../lib/format'
import type { GitHubRepo } from '../lib/types'

interface RepoListProps {
  repos: GitHubRepo[]
  selectedId: number | null
  onSelect: (repo: GitHubRepo) => void
}

export function RepoList({ repos, selectedId, onSelect }: RepoListProps) {
  if (repos.length === 0) {
    return <p className="muted">No repositories match the current filter.</p>
  }

  return (
    <ul className="repo-list">
      {repos.map((repo) => (
        <li key={repo.id}>
          <button
            type="button"
            className={repo.id === selectedId ? 'repo selected' : 'repo'}
            aria-pressed={repo.id === selectedId}
            onClick={() => onSelect(repo)}
          >
            <div className="repo-head">
              <strong>{repo.name}</strong>
              {repo.private && <span className="badge">private</span>}
              {repo.archived && <span className="badge">archived</span>}
              {repo.fork && <span className="badge">fork</span>}
            </div>
            <p className="muted">{repo.description ?? 'No description'}</p>
            <div className="repo-meta">
              {repo.language && <span>{repo.language}</span>}
              <span>★ {compactNumber(repo.stargazers_count)}</span>
              <span>⑂ {compactNumber(repo.forks_count)}</span>
              <span>{repo.open_issues_count} issues</span>
              <span>updated {relativeTime(repo.updated_at)}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
