import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  downloadExport,
  fileNameFor,
  serialize,
  toCsv,
  toJson,
  toMarkdown,
} from './export'
import { makeRepo } from '../test/factories'

const NOW = new Date('2026-09-04T12:00:00Z')

describe('toCsv', () => {
  it('writes a header row and one row per repo', () => {
    const csv = toCsv([makeRepo({ name: 'infra' }), makeRepo({ id: 2, name: 'web' })])
    const [header, ...rows] = csv.split('\n')
    expect(header).toBe(
      'name,description,language,stars,forks,open_issues,default_branch,topics,updated_at',
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('infra')
    expect(rows[1]).toContain('web')
  })

  it('quotes values containing commas, quotes or newlines', () => {
    expect(toCsv([makeRepo({ description: 'one, two' })])).toContain('"one, two"')
    expect(toCsv([makeRepo({ description: 'say "hi"' })])).toContain('"say ""hi"""')
    expect(toCsv([makeRepo({ description: 'line\nbreak' })])).toContain('"line\nbreak"')
  })

  it('renders null description and language as empty cells', () => {
    const csv = toCsv([makeRepo({ description: null, language: null, topics: [] })])
    expect(csv.split('\n')[1]).toContain('infra,,,')
  })

  it('joins topics with spaces', () => {
    expect(toCsv([makeRepo({ topics: ['aws', 'terraform'] })])).toContain('aws terraform')
  })

  it('emits only the header for an empty list', () => {
    expect(toCsv([]).split('\n')).toHaveLength(1)
  })
})

describe('toJson', () => {
  it('projects the fields worth exporting', () => {
    const parsed = JSON.parse(toJson([makeRepo()]))
    expect(parsed).toEqual([
      {
        name: 'infra',
        full_name: 'mevijays/infra',
        description: 'Terraform modules',
        language: 'HCL',
        stars: 12,
        forks: 3,
        open_issues: 2,
        topics: ['terraform', 'aws'],
        url: 'https://github.com/mevijays/infra',
      },
    ])
  })

  it('serializes an empty list', () => {
    expect(JSON.parse(toJson([]))).toEqual([])
  })
})

describe('toMarkdown', () => {
  it('renders a linked table', () => {
    const md = toMarkdown([makeRepo()])
    expect(md).toContain('| Repository | Language | Stars | Open issues |')
    expect(md).toContain('[infra](https://github.com/mevijays/infra)')
    expect(md).toContain('| HCL | 12 | 2 |')
  })

  it('falls back to a dash for a missing language', () => {
    expect(toMarkdown([makeRepo({ language: null })])).toContain('| — |')
  })
})

describe('serialize', () => {
  it.each([
    ['csv', 'name,description'],
    ['json', '"full_name"'],
    ['markdown', '| Repository |'],
  ] as const)('dispatches %s', (format, fragment) => {
    expect(serialize([makeRepo()], format)).toContain(fragment)
  })
})

describe('fileNameFor', () => {
  it.each([
    ['csv', 'mevijays-repositories-2026-09-04.csv'],
    ['json', 'mevijays-repositories-2026-09-04.json'],
    ['markdown', 'mevijays-repositories-2026-09-04.md'],
  ] as const)('names a %s export', (format, expected) => {
    expect(fileNameFor('mevijays', format, NOW)).toBe(expected)
  })
})

describe('downloadExport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubObjectUrl() {
    const createObjectURL = vi.fn(() => 'blob:fake')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    return { createObjectURL, revokeObjectURL }
  }

  it('creates a named anchor, clicks it and cleans up', () => {
    const { createObjectURL, revokeObjectURL } = stubObjectUrl()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadExport([makeRepo()], 'mevijays', 'csv', NOW)

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    // The anchor must not be left behind in the document.
    expect(document.querySelectorAll('a[download]')).toHaveLength(0)
  })

  it.each([
    ['csv', 'text/csv;charset=utf-8'],
    ['json', 'application/json;charset=utf-8'],
    ['markdown', 'text/markdown;charset=utf-8'],
  ] as const)('uses the %s mime type', (format, mime) => {
    const { createObjectURL } = stubObjectUrl()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadExport([makeRepo()], 'mevijays', format, NOW)

    expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe(mime)
  })

  it('names the downloaded file after the org and date', () => {
    stubObjectUrl()
    let downloadName = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download
    })

    downloadExport([makeRepo()], 'vijayslab', 'json', NOW)

    expect(downloadName).toBe('vijayslab-repositories-2026-09-04.json')
  })
})
