import { describe, expect, it } from 'vitest'
import { toCsv } from './export'
import { makeRepo } from '../test/factories'

describe('toCsv', () => {
  it('writes a header row and one row per repo', () => {
    const csv = toCsv([makeRepo({ name: 'infra' })])
    const [header, first] = csv.split('\n')
    expect(header).toContain('name,description,language')
    expect(first).toContain('infra')
  })

  it('quotes values containing commas', () => {
    const csv = toCsv([makeRepo({ description: 'one, two' })])
    expect(csv).toContain('"one, two"')
  })
})
