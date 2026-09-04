export class GitHubApiError extends Error {
  readonly status: number
  readonly url: string

  constructor(message: string, status: number, url: string) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = status
    this.url = url
  }

  /** A human-friendly explanation tailored to the HTTP status. */
  get hint(): string {
    switch (this.status) {
      case 401:
        return 'The token was rejected. Check that it is valid and has not expired.'
      case 403:
        return 'Access forbidden. The token may be missing a required scope or you hit the rate limit.'
      case 404:
        return 'Not found. The resource may be private or the token lacks access to it.'
      case 422:
        return 'GitHub could not process the request. Check the values you supplied.'
      default:
        return this.status >= 500
          ? 'GitHub returned a server error. Try again in a moment.'
          : 'The request could not be completed.'
    }
  }
}

export function isGitHubApiError(value: unknown): value is GitHubApiError {
  return value instanceof GitHubApiError
}

export function toMessage(error: unknown): string {
  if (isGitHubApiError(error)) return `${error.message} — ${error.hint}`
  if (error instanceof Error) return error.message
  return String(error)
}
