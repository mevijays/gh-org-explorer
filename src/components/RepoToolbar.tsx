import type { RepoSort } from '../lib/format'

interface RepoToolbarProps {
  query: string
  sort: RepoSort
  count: number
  total: number
  onQueryChange: (value: string) => void
  onSortChange: (value: RepoSort) => void
  onRefresh: () => void
  busy: boolean
}

export function RepoToolbar({
  query,
  sort,
  count,
  total,
  onQueryChange,
  onSortChange,
  onRefresh,
  busy,
}: RepoToolbarProps) {
  return (
    <div className="toolbar">
      <input
        type="search"
        aria-label="Filter repositories"
        placeholder="Filter by name, language or topic"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <label htmlFor="sort">Sort</label>
      <select
        id="sort"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as RepoSort)}
      >
        <option value="updated">Recently updated</option>
        <option value="stars">Most stars</option>
        <option value="name">Name</option>
      </select>
      <button type="button" onClick={onRefresh} disabled={busy}>
        {busy ? 'Refreshing…' : 'Refresh'}
      </button>
      <span className="muted">
        {count} of {total}
      </span>
    </div>
  )
}
