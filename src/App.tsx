import { useMemo, useState } from 'react'
import { OrgList } from './components/OrgList'
import { RepoDetail } from './components/RepoDetail'
import { RepoList } from './components/RepoList'
import { RepoToolbar } from './components/RepoToolbar'
import { StatsBar } from './components/StatsBar'
import { TokenForm } from './components/TokenForm'
import { useGitHub, type UseGitHubOptions } from './hooks/useGitHub'
import { filterRepos, sortRepos, type RepoSort } from './lib/format'

export function App(options: UseGitHubOptions = {}) {
  const gh = useGitHub(options)
  const { state } = gh
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<RepoSort>('updated')

  const visibleRepos = useMemo(
    () => sortRepos(filterRepos(state.repos, query), sort),
    [state.repos, query, sort],
  )

  if (!state.viewer) {
    return (
      <main className="shell centered">
        <h1>GitHub Org Explorer</h1>
        <TokenForm
          onSubmit={(token) => void gh.connect(token)}
          busy={state.connecting}
          error={state.authError}
        />
      </main>
    )
  }

  return (
    <main className="shell">
      <header className="app-header">
        <h1>GitHub Org Explorer</h1>
        <div className="viewer">
          <img src={state.viewer.avatar_url} alt="" width={32} height={32} />
          <span>{state.viewer.name ?? state.viewer.login}</span>
          <button type="button" onClick={gh.disconnect}>
            Sign out
          </button>
        </div>
      </header>

      <div className="columns">
        <aside>
          <OrgList
            orgs={state.orgs}
            selected={state.selectedOrg}
            onSelect={(login) => void gh.selectOrg(login)}
          />
        </aside>

        <section className="card">
          <h2>{state.selectedOrg ? `Repositories in ${state.selectedOrg}` : 'Repositories'}</h2>
          {!state.selectedOrg && <p className="muted">Pick an organization to begin.</p>}
          {state.selectedOrg && (
            <>
              <StatsBar repos={state.repos} />
              <RepoToolbar
                query={query}
                sort={sort}
                count={visibleRepos.length}
                total={state.repos.length}
                onQueryChange={setQuery}
                onSortChange={setSort}
                onRefresh={() => void gh.refreshRepos()}
                busy={state.loadingRepos}
              />
              {state.loadingRepos ? (
                <p className="muted">Loading repositories…</p>
              ) : (
                <RepoList
                  repos={visibleRepos}
                  selectedId={state.selectedRepo?.id ?? null}
                  onSelect={(repo) => void gh.selectRepo(repo)}
                />
              )}
            </>
          )}
        </section>

        <section>
          {state.selectedRepo ? (
            <RepoDetail
              repo={state.selectedRepo}
              starred={state.starred}
              branches={state.branches}
              busy={state.busy}
              notice={state.notice}
              error={state.actionError}
              onToggleStar={gh.toggleStar}
              onLoadBranches={gh.loadBranches}
              onCreateIssue={gh.createIssue}
              onSaveTopics={gh.saveTopics}
              onSaveDescription={gh.saveDescription}
            />
          ) : (
            <div className="card">
              <h2>Repository actions</h2>
              <p className="muted">Select a repository to star it, list branches, file an
                issue or edit its metadata.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
