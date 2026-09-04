import { useCallback, useMemo, useState } from 'react'
import { GitHubClient } from '../lib/github'
import { toMessage } from '../lib/errors'
import { clearToken, loadToken, saveToken } from '../lib/storage'
import type { GitHubBranch, GitHubOrg, GitHubRepo, GitHubUser } from '../lib/types'

export interface GitHubState {
  token: string | null
  viewer: GitHubUser | null
  orgs: GitHubOrg[]
  selectedOrg: string | null
  repos: GitHubRepo[]
  selectedRepo: GitHubRepo | null
  starred: boolean | null
  branches: GitHubBranch[] | null
  connecting: boolean
  loadingRepos: boolean
  busy: string | null
  authError: string | null
  actionError: string | null
  notice: string | null
}

const initialState: GitHubState = {
  token: null,
  viewer: null,
  orgs: [],
  selectedOrg: null,
  repos: [],
  selectedRepo: null,
  starred: null,
  branches: null,
  connecting: false,
  loadingRepos: false,
  busy: null,
  authError: null,
  actionError: null,
  notice: null,
}

export interface UseGitHubOptions {
  /** Injected in tests so the hook never touches the network. */
  createClient?: (token: string) => GitHubClient
}

export function useGitHub(options: UseGitHubOptions = {}) {
  const createClient = options.createClient ?? ((token: string) => new GitHubClient(token))
  const [state, setState] = useState<GitHubState>(() => ({
    ...initialState,
    token: loadToken(),
  }))

  const client = useMemo(
    () => (state.token ? createClient(state.token) : null),
    // `createClient` is stable for the lifetime of a mount in every real caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.token],
  )

  const connect = useCallback(
    async (token: string) => {
      setState((prev) => ({ ...prev, connecting: true, authError: null }))
      try {
        const candidate = createClient(token)
        const viewer = await candidate.getViewer()
        const orgs = await candidate.listOrgs()
        saveToken(token)
        setState((prev) => ({
          ...prev,
          token,
          viewer,
          orgs,
          connecting: false,
          authError: null,
        }))
      } catch (error) {
        setState((prev) => ({
          ...prev,
          connecting: false,
          token: null,
          viewer: null,
          authError: toMessage(error),
        }))
      }
    },
    [createClient],
  )

  const disconnect = useCallback(() => {
    clearToken()
    setState({ ...initialState, token: null })
  }, [])

  const selectOrg = useCallback(
    async (login: string) => {
      if (!client) return
      setState((prev) => ({
        ...prev,
        selectedOrg: login,
        loadingRepos: true,
        repos: [],
        selectedRepo: null,
        branches: null,
        starred: null,
        actionError: null,
        notice: null,
      }))
      try {
        const repos = await client.listOrgRepos(login)
        setState((prev) => ({ ...prev, repos, loadingRepos: false }))
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loadingRepos: false,
          actionError: toMessage(error),
        }))
      }
    },
    [client],
  )

  const refreshRepos = useCallback(async () => {
    if (state.selectedOrg) await selectOrg(state.selectedOrg)
  }, [selectOrg, state.selectedOrg])

  const selectRepo = useCallback(
    async (repo: GitHubRepo) => {
      setState((prev) => ({
        ...prev,
        selectedRepo: repo,
        branches: null,
        starred: null,
        actionError: null,
        notice: null,
      }))
      if (!client) return
      try {
        const starred = await client.isStarred(repo.full_name.split('/')[0], repo.name)
        setState((prev) =>
          prev.selectedRepo?.id === repo.id ? { ...prev, starred } : prev,
        )
      } catch (error) {
        setState((prev) => ({ ...prev, actionError: toMessage(error) }))
      }
    },
    [client],
  )

  /** Runs an action with shared busy/notice/error bookkeeping. */
  const run = useCallback(
    async (key: string, action: () => Promise<string>) => {
      setState((prev) => ({ ...prev, busy: key, actionError: null, notice: null }))
      try {
        const notice = await action()
        setState((prev) => ({ ...prev, busy: null, notice }))
      } catch (error) {
        setState((prev) => ({ ...prev, busy: null, actionError: toMessage(error) }))
      }
    },
    [],
  )

  const toggleStar = useCallback(
    async (repo: GitHubRepo) => {
      if (!client) return
      const owner = repo.full_name.split('/')[0]
      const next = !(state.starred ?? false)
      await run('star', async () => {
        await client.setStarred(owner, repo.name, next)
        setState((prev) => ({ ...prev, starred: next }))
        return next ? `Starred ${repo.full_name}.` : `Removed star from ${repo.full_name}.`
      })
    },
    [client, run, state.starred],
  )

  const loadBranches = useCallback(
    async (repo: GitHubRepo) => {
      if (!client) return
      const owner = repo.full_name.split('/')[0]
      await run('branches', async () => {
        const branches = await client.listBranches(owner, repo.name)
        setState((prev) => ({ ...prev, branches }))
        return `Loaded ${branches.length} branch${branches.length === 1 ? '' : 'es'}.`
      })
    },
    [client, run],
  )

  const createIssue = useCallback(
    async (repo: GitHubRepo, title: string, body: string) => {
      if (!client) return
      const owner = repo.full_name.split('/')[0]
      await run('issue', async () => {
        const issue = await client.createIssue(owner, repo.name, title, body)
        return `Created issue #${issue.number}: ${issue.title}`
      })
    },
    [client, run],
  )

  const saveTopics = useCallback(
    async (repo: GitHubRepo, topics: string[]) => {
      if (!client) return
      const owner = repo.full_name.split('/')[0]
      await run('topics', async () => {
        const result = await client.updateTopics(owner, repo.name, topics)
        setState((prev) => ({
          ...prev,
          repos: prev.repos.map((item) =>
            item.id === repo.id ? { ...item, topics: result.names } : item,
          ),
        }))
        return `Saved ${result.names.length} topic${result.names.length === 1 ? '' : 's'}.`
      })
    },
    [client, run],
  )

  const saveDescription = useCallback(
    async (repo: GitHubRepo, description: string) => {
      if (!client) return
      const owner = repo.full_name.split('/')[0]
      await run('description', async () => {
        const updated = await client.updateDescription(owner, repo.name, description)
        setState((prev) => ({
          ...prev,
          repos: prev.repos.map((item) =>
            item.id === repo.id ? { ...item, description: updated.description } : item,
          ),
          selectedRepo:
            prev.selectedRepo?.id === repo.id
              ? { ...prev.selectedRepo, description: updated.description }
              : prev.selectedRepo,
        }))
        return 'Description updated.'
      })
    },
    [client, run],
  )

  return {
    state,
    connect,
    disconnect,
    selectOrg,
    refreshRepos,
    selectRepo,
    toggleStar,
    loadBranches,
    createIssue,
    saveTopics,
    saveDescription,
  }
}
