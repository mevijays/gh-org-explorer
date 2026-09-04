import type { GitHubRepo } from './types'

export type ExportFormat = 'csv' | 'json' | 'markdown'

const COLUMNS = [
  'name',
  'description',
  'language',
  'stars',
  'forks',
  'open_issues',
  'default_branch',
  'topics',
  'updated_at',
] as const

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function row(repo: GitHubRepo): string[] {
  return [
    repo.name,
    repo.description ?? '',
    repo.language ?? '',
    String(repo.stargazers_count),
    String(repo.forks_count),
    String(repo.open_issues_count),
    repo.default_branch,
    repo.topics.join(' '),
    repo.updated_at,
  ]
}

export function toCsv(repos: GitHubRepo[]): string {
  const lines = [COLUMNS.join(',')]
  for (const repo of repos) {
    lines.push(row(repo).map(escapeCsv).join(','))
  }
  return lines.join('\n')
}

export function toJson(repos: GitHubRepo[]): string {
  return JSON.stringify(
    repos.map((repo) => ({
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      open_issues: repo.open_issues_count,
      topics: repo.topics,
      url: repo.html_url,
    })),
    null,
    2,
  )
}

export function toMarkdown(repos: GitHubRepo[]): string {
  const lines = ['| Repository | Language | Stars | Open issues |', '| --- | --- | ---: | ---: |']
  for (const repo of repos) {
    lines.push(
      `| [${repo.name}](${repo.html_url}) | ${repo.language ?? '—'} | ` +
        `${repo.stargazers_count} | ${repo.open_issues_count} |`,
    )
  }
  return lines.join('\n')
}

export function serialize(repos: GitHubRepo[], format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return toCsv(repos)
    case 'json':
      return toJson(repos)
    case 'markdown':
      return toMarkdown(repos)
  }
}

export function fileNameFor(org: string, format: ExportFormat, now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10)
  const extension = format === 'markdown' ? 'md' : format
  return `${org}-repositories-${stamp}.${extension}`
}

/** Triggers a browser download of the serialized repository list. */
export function downloadExport(
  repos: GitHubRepo[],
  org: string,
  format: ExportFormat,
  now: Date = new Date(),
): void {
  const contents = serialize(repos, format)
  const mime =
    format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/markdown'
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileNameFor(org, format, now)
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
