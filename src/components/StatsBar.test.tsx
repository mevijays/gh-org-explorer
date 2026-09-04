import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsBar } from './StatsBar'
import { makeRepo } from '../test/factories'

describe('StatsBar', () => {
  it('renders nothing without repos', () => {
    const { container } = render(<StatsBar repos={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('summarizes the repositories', () => {
    render(
      <StatsBar
        repos={[
          makeRepo({ id: 1, stargazers_count: 1200, forks_count: 4, open_issues_count: 2, language: 'Go' }),
          makeRepo({ id: 2, stargazers_count: 300, forks_count: 1, open_issues_count: 0, language: 'Rust' }),
        ]}
      />,
    )

    const stats = screen.getByRole('group', { name: 'Repository statistics' })
    expect(stats).toHaveTextContent('1.5k')
    expect(stats).toHaveTextContent('Go, Rust')
  })

  it('shows a dash when no language is set', () => {
    render(<StatsBar repos={[makeRepo({ language: null })]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
