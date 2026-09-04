import type { GitHubOrg } from '../lib/types'

interface OrgListProps {
  orgs: GitHubOrg[]
  selected: string | null
  onSelect: (login: string) => void
}

export function OrgList({ orgs, selected, onSelect }: OrgListProps) {
  if (orgs.length === 0) {
    return (
      <div className="card">
        <h2>Organizations</h2>
        <p className="muted">
          No organizations visible. A token needs the <code>read:org</code> scope to see them.
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Organizations ({orgs.length})</h2>
      <ul className="org-list">
        {orgs.map((org) => (
          <li key={org.id}>
            <button
              type="button"
              className={org.login === selected ? 'org selected' : 'org'}
              aria-pressed={org.login === selected}
              onClick={() => onSelect(org.login)}
            >
              <img src={org.avatar_url} alt="" width={28} height={28} />
              <span>
                <strong>{org.login}</strong>
                {org.description && <em>{org.description}</em>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
