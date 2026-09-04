export interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
  public_repos: number
}

export interface GitHubOrg {
  id: number
  login: string
  description: string | null
  avatar_url: string
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  private: boolean
  archived: boolean
  fork: boolean
  language: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  default_branch: string
  topics: string[]
  updated_at: string
}

export interface GitHubBranch {
  name: string
  protected: boolean
  commit: { sha: string }
}

export interface GitHubIssue {
  number: number
  title: string
  html_url: string
  state: string
}

export interface RateLimit {
  limit: number
  remaining: number
  reset: number
}
