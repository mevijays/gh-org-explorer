import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrgList } from './OrgList'
import { makeOrg } from '../test/factories'

describe('OrgList', () => {
  it('explains the empty case', () => {
    render(<OrgList orgs={[]} selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText(/No organizations visible/)).toBeInTheDocument()
  })

  it('renders orgs and marks the selected one', () => {
    render(
      <OrgList
        orgs={[makeOrg({ id: 1, login: 'mevijays' }), makeOrg({ id: 2, login: 'vijayslab', description: null })]}
        selected="vijayslab"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('Organizations (2)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mevijays/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /vijayslab/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reports the clicked org', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<OrgList orgs={[makeOrg({ login: 'mevijays' })]} selected={null} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /mevijays/ }))
    expect(onSelect).toHaveBeenCalledWith('mevijays')
  })
})
