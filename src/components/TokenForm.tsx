import { useState } from 'react'
import { looksLikeToken } from '../lib/format'

interface TokenFormProps {
  onSubmit: (token: string) => void
  busy: boolean
  error: string | null
}

export function TokenForm({ onSubmit, busy, error }: TokenFormProps) {
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)

  const malformed = touched && value.length > 0 && !looksLikeToken(value)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (value.trim().length === 0) return
    onSubmit(value.trim())
  }

  return (
    <form className="card token-form" onSubmit={handleSubmit}>
      <h2>Connect to GitHub</h2>
      <p className="muted">
        Paste a personal access token with <code>read:org</code> and <code>repo</code> scopes.
        It is kept in your browser and sent only to api.github.com.
      </p>
      <label htmlFor="token">Personal access token</label>
      <input
        id="token"
        name="token"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="ghp_… or github_pat_…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => setTouched(true)}
      />
      {malformed && (
        <p className="warn" role="status">
          That does not look like a GitHub token, but you can still try it.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || value.trim().length === 0}>
        {busy ? 'Connecting…' : 'Connect'}
      </button>
    </form>
  )
}
