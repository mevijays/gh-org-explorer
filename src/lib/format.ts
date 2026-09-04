import type { GitHubRepo } from './types'

/** Classic PATs are `ghp_…`; fine-grained are `github_pat_…`. */
export function looksLikeToken(value: string): boolean {
  const token = value.trim()
  if (token.length < 20) return false
  return /^(gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,})$/.test(token)
}

export function maskToken(value: string): string {
  const token = value.trim()
  if (token.length <= 8) return '•'.repeat(token.length)
  return `${token.slice(0, 4)}${'•'.repeat(6)}${token.slice(-4)}`
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'unknown'
  const seconds = Math.round((now.getTime() - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

export function compactNumber(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`
  return `${(value / 1_000_000).toFixed(1)}M`
}

export function parseTopics(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((topic) => topic.trim().toLowerCase())
        .filter((topic) => topic.length > 0),
    ),
  )
}

export type RepoSort = 'updated' | 'stars' | 'name'

export function filterRepos(repos: GitHubRepo[], query: string): GitHubRepo[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return repos
  return repos.filter((repo) => {
    const haystack = [repo.name, repo.description ?? '', repo.language ?? '', ...repo.topics]
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
}

export function sortRepos(repos: GitHubRepo[], sort: RepoSort): GitHubRepo[] {
  const copy = [...repos]
  switch (sort) {
    case 'stars':
      return copy.sort((a, b) => b.stargazers_count - a.stargazers_count)
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name))
    case 'updated':
    default:
      return copy.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
  }
}

export function summarizeRepos(repos: GitHubRepo[]): {
  total: number
  stars: number
  forks: number
  openIssues: number
  languages: string[]
} {
  const languages = new Set<string>()
  let stars = 0
  let forks = 0
  let openIssues = 0
  for (const repo of repos) {
    stars += repo.stargazers_count
    forks += repo.forks_count
    openIssues += repo.open_issues_count
    if (repo.language) languages.add(repo.language)
  }
  return {
    total: repos.length,
    stars,
    forks,
    openIssues,
    languages: [...languages].sort(),
  }
}
