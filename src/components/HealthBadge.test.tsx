import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthBadge } from './HealthBadge'
import { makeRepo } from '../test/factories'

describe('HealthBadge', () => {
  it('renders the level and score', () => {
    render(<HealthBadge repo={makeRepo({ updated_at: new Date().toISOString() })} />)
    const badge = screen.getByText(/Healthy/)
    expect(badge).toHaveTextContent('Healthy · 100')
    expect(badge).toHaveClass('health-healthy')
    expect(badge).toHaveAttribute('title', 'No issues detected')
  })

  it('lists the reasons in the tooltip', () => {
    render(<HealthBadge repo={makeRepo({ description: null, topics: [] })} />)
    const badge = screen.getByText(/·/)
    expect(badge).toHaveAttribute('title', 'No description · No topics')
  })

  it('exposes an accessible label', () => {
    render(<HealthBadge repo={makeRepo({ archived: true })} />)
    expect(screen.getByLabelText('Health: Stale, score 0')).toBeInTheDocument()
  })
})
