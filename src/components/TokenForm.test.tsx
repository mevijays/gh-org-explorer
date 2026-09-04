import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TokenForm } from './TokenForm'

describe('TokenForm', () => {
  it('disables submit until a token is typed', async () => {
    const user = userEvent.setup()
    render(<TokenForm onSubmit={vi.fn()} busy={false} error={null} />)

    const button = screen.getByRole('button', { name: 'Connect' })
    expect(button).toBeDisabled()

    await user.type(screen.getByLabelText('Personal access token'), 'ghp_' + 'a'.repeat(36))
    expect(button).toBeEnabled()
  })

  it('submits the trimmed token', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TokenForm onSubmit={onSubmit} busy={false} error={null} />)

    await user.type(screen.getByLabelText('Personal access token'), '  ghp_abc123  ')
    await user.click(screen.getByRole('button', { name: 'Connect' }))

    expect(onSubmit).toHaveBeenCalledWith('ghp_abc123')
  })

  it('warns about a malformed token after blur but still allows submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TokenForm onSubmit={onSubmit} busy={false} error={null} />)

    const input = screen.getByLabelText('Personal access token')
    await user.type(input, 'clearly-not-a-token')
    await user.tab()

    expect(screen.getByRole('status')).toHaveTextContent('does not look like a GitHub token')
    await user.click(screen.getByRole('button', { name: 'Connect' }))
    expect(onSubmit).toHaveBeenCalledWith('clearly-not-a-token')
  })

  it('ignores a whitespace-only submission', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TokenForm onSubmit={onSubmit} busy={false} error={null} />)

    await user.type(screen.getByLabelText('Personal access token'), '   ')
    await user.keyboard('{Enter}')

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows the busy state and the error', () => {
    render(<TokenForm onSubmit={vi.fn()} busy error="Bad credentials" />)
    expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Bad credentials')
  })
})
