import { useState } from 'react'
import { parseTopics } from '../lib/format'
import type { GitHubBranch, GitHubRepo } from '../lib/types'

export interface RepoActions {
  onToggleStar: (repo: GitHubRepo) => Promise<void>
  onLoadBranches: (repo: GitHubRepo) => Promise<void>
  onCreateIssue: (repo: GitHubRepo, title: string, body: string) => Promise<void>
  onSaveTopics: (repo: GitHubRepo, topics: string[]) => Promise<void>
  onSaveDescription: (repo: GitHubRepo, description: string) => Promise<void>
}

interface RepoDetailProps extends RepoActions {
  repo: GitHubRepo
  starred: boolean | null
  branches: GitHubBranch[] | null
  busy: string | null
  notice: string | null
  error: string | null
}

export function RepoDetail({
  repo,
  starred,
  branches,
  busy,
  notice,
  error,
  onToggleStar,
  onLoadBranches,
  onCreateIssue,
  onSaveTopics,
  onSaveDescription,
}: RepoDetailProps) {
  const [issueTitle, setIssueTitle] = useState('')
  const [issueBody, setIssueBody] = useState('')
  const [topics, setTopics] = useState(repo.topics.join(', '))
  const [description, setDescription] = useState(repo.description ?? '')

  async function submitIssue(event: React.FormEvent) {
    event.preventDefault()
    if (issueTitle.trim().length === 0) return
    await onCreateIssue(repo, issueTitle.trim(), issueBody.trim())
    setIssueTitle('')
    setIssueBody('')
  }

  return (
    <div className="card repo-detail">
      <header>
        <h2>{repo.full_name}</h2>
        <a href={repo.html_url} target="_blank" rel="noreferrer">
          Open on GitHub ↗
        </a>
      </header>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section>
        <h3>Actions</h3>
        <div className="button-row">
          <button
            type="button"
            disabled={busy === 'star'}
            onClick={() => void onToggleStar(repo)}
          >
            {starred === null ? 'Checking star…' : starred ? '★ Unstar' : '☆ Star'}
          </button>
          <button
            type="button"
            disabled={busy === 'branches'}
            onClick={() => void onLoadBranches(repo)}
          >
            {busy === 'branches' ? 'Loading branches…' : 'List branches'}
          </button>
        </div>
        {branches && (
          <ul className="branch-list">
            {branches.map((branch) => (
              <li key={branch.name}>
                <code>{branch.name}</code>
                {branch.protected && <span className="badge">protected</span>}
                {branch.name === repo.default_branch && <span className="badge">default</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>Create an issue</h3>
        <form onSubmit={submitIssue}>
          <label htmlFor="issue-title">Title</label>
          <input
            id="issue-title"
            value={issueTitle}
            onChange={(event) => setIssueTitle(event.target.value)}
          />
          <label htmlFor="issue-body">Body</label>
          <textarea
            id="issue-body"
            rows={3}
            value={issueBody}
            onChange={(event) => setIssueBody(event.target.value)}
          />
          <button type="submit" disabled={busy === 'issue' || issueTitle.trim().length === 0}>
            {busy === 'issue' ? 'Creating…' : 'Create issue'}
          </button>
        </form>
      </section>

      <section>
        <h3>Metadata</h3>
        <label htmlFor="repo-description">Description</label>
        <input
          id="repo-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <button
          type="button"
          disabled={busy === 'description'}
          onClick={() => void onSaveDescription(repo, description.trim())}
        >
          {busy === 'description' ? 'Saving…' : 'Save description'}
        </button>

        <label htmlFor="repo-topics">Topics (comma or space separated)</label>
        <input
          id="repo-topics"
          value={topics}
          onChange={(event) => setTopics(event.target.value)}
        />
        <button
          type="button"
          disabled={busy === 'topics'}
          onClick={() => void onSaveTopics(repo, parseTopics(topics))}
        >
          {busy === 'topics' ? 'Saving…' : 'Save topics'}
        </button>
      </section>
    </div>
  )
}
