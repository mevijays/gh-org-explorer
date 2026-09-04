#!/usr/bin/env node
/**
 * Turns a vitest v8 coverage run into a PR-friendly report and enforces two
 * gates:
 *
 *   - overall line coverage across the project
 *   - line coverage restricted to the lines this branch adds or changes
 *
 * The "new lines" figure is what shifts quality left: a large, well-covered
 * codebase can otherwise absorb an entirely untested new file without the
 * overall number moving.
 *
 * Usage: node scripts/coverage-report.mjs [--base <ref>] [--out <file>]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const REPO_ROOT = process.cwd()
const COVERAGE_FILE = resolve(REPO_ROOT, 'coverage/coverage-final.json')
const TEST_RESULTS = resolve(REPO_ROOT, 'test-results/results.json')

const OVERALL_THRESHOLD = Number(process.env.COVERAGE_OVERALL_THRESHOLD ?? 80)
const NEW_LINE_THRESHOLD = Number(process.env.COVERAGE_NEW_LINE_THRESHOLD ?? 90)

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const baseRef = arg('base', process.env.COVERAGE_BASE_REF ?? '')
const outFile = arg('out', resolve(REPO_ROOT, 'coverage/report.md'))

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', cwd: REPO_ROOT })
}

/* ------------------------------------------------------------------ *
 * Coverage: collapse istanbul-shaped statement data down to lines.
 * ------------------------------------------------------------------ */

/** @returns {Map<string, Map<number, number>>} file -> (line -> hit count) */
function readLineCoverage() {
  if (!existsSync(COVERAGE_FILE)) {
    throw new Error(`No coverage data at ${COVERAGE_FILE}. Run the tests with --coverage first.`)
  }
  const raw = JSON.parse(readFileSync(COVERAGE_FILE, 'utf8'))
  const files = new Map()

  for (const [absolutePath, entry] of Object.entries(raw)) {
    const lines = new Map()
    for (const [id, location] of Object.entries(entry.statementMap ?? {})) {
      const hits = entry.s?.[id] ?? 0
      const start = location.start?.line
      const end = location.end?.line ?? start
      if (typeof start !== 'number') continue
      for (let line = start; line <= end; line += 1) {
        lines.set(line, Math.max(lines.get(line) ?? 0, hits))
      }
    }
    files.set(relative(REPO_ROOT, absolutePath), lines)
  }
  return files
}

/* ------------------------------------------------------------------ *
 * Diff: which lines does this branch actually add?
 * ------------------------------------------------------------------ */

/** Parses unified diff hunks into the set of added line numbers per file. */
function parseAddedLines(diff) {
  const added = new Map()
  let file = null
  let lineNumber = 0

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const path = line.slice(4).trim()
      file = path === '/dev/null' ? null : path.replace(/^b\//, '')
      if (file && !added.has(file)) added.set(file, new Set())
      continue
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (hunk) {
      lineNumber = Number(hunk[1])
      continue
    }
    if (file === null) continue
    if (line.startsWith('+')) {
      added.get(file).add(lineNumber)
      lineNumber += 1
    } else if (line.startsWith('-') || line.startsWith('\\')) {
      // Removed lines and "\ No newline" markers do not advance the new file.
    } else if (line.startsWith(' ')) {
      lineNumber += 1
    }
  }
  return added
}

function resolveMergeBase(ref) {
  if (!ref) return null
  const candidates = [ref, `origin/${ref}`, `refs/remotes/origin/${ref}`]
  for (const candidate of candidates) {
    try {
      const sha = git(['merge-base', candidate, 'HEAD']).trim()
      if (sha) return { sha, ref: candidate }
    } catch {
      // Try the next spelling of the ref.
    }
  }
  return null
}

function collectAddedLines() {
  const base = resolveMergeBase(baseRef)
  if (!base) return { added: new Map(), base: null }
  const diff = git(['diff', '--unified=0', '--diff-filter=ACMR', base.sha, 'HEAD', '--', 'src'])
  return { added: parseAddedLines(diff), base }
}

/* ------------------------------------------------------------------ *
 * Reporting
 * ------------------------------------------------------------------ */

const percent = (covered, total) => (total === 0 ? 100 : (covered / total) * 100)
const fmt = (value) => `${value.toFixed(2)}%`
const mark = (ok) => (ok ? '✅' : '❌')

function bar(value) {
  const filled = Math.round(Math.min(100, Math.max(0, value)) / 5)
  return `${'█'.repeat(filled)}${'░'.repeat(20 - filled)}`
}

function readTestTotals() {
  if (!existsSync(TEST_RESULTS)) return null
  try {
    const raw = JSON.parse(readFileSync(TEST_RESULTS, 'utf8'))
    return {
      total: raw.numTotalTests ?? 0,
      passed: raw.numPassedTests ?? 0,
      failed: raw.numFailedTests ?? 0,
      skipped: (raw.numPendingTests ?? 0) + (raw.numTodoTests ?? 0),
      suites: raw.numTotalTestSuites ?? 0,
    }
  } catch {
    return null
  }
}

function main() {
  const coverage = readLineCoverage()
  const { added, base } = collectAddedLines()

  let overallCovered = 0
  let overallTotal = 0
  const perFile = []

  for (const [file, lines] of coverage) {
    let covered = 0
    for (const hits of lines.values()) if (hits > 0) covered += 1
    overallCovered += covered
    overallTotal += lines.size
    perFile.push({ file, covered, total: lines.size, pct: percent(covered, lines.size) })
  }

  let newCovered = 0
  let newTotal = 0
  const newFiles = []
  const uncoveredNewLines = []

  for (const [file, addedSet] of added) {
    const lines = coverage.get(file)
    if (!lines) continue // Not an instrumented source file (test, config, asset).
    let covered = 0
    let total = 0
    const missing = []
    for (const line of [...addedSet].sort((a, b) => a - b)) {
      if (!lines.has(line)) continue // Blank line, comment or type-only line.
      total += 1
      if (lines.get(line) > 0) covered += 1
      else missing.push(line)
    }
    if (total === 0) continue
    newCovered += covered
    newTotal += total
    newFiles.push({ file, covered, total, pct: percent(covered, total), missing })
    if (missing.length > 0) uncoveredNewLines.push({ file, missing })
  }

  const overallPct = percent(overallCovered, overallTotal)
  const newPct = percent(newCovered, newTotal)
  const overallOk = overallPct >= OVERALL_THRESHOLD
  const newOk = newTotal === 0 || newPct >= NEW_LINE_THRESHOLD
  const passed = overallOk && newOk

  const tests = readTestTotals()
  const out = []

  out.push('## 🧪 Coverage report')
  out.push('')
  if (tests) {
    out.push(
      `**Tests:** ${tests.total} total · ✅ ${tests.passed} passed · ` +
        `${tests.failed > 0 ? '❌' : '✔️'} ${tests.failed} failed · ⏭️ ${tests.skipped} skipped ` +
        `(across ${tests.suites} suites)`,
    )
    out.push('')
  }

  out.push('| Gate | Result | Threshold | Status |')
  out.push('| --- | --- | --- | --- |')
  out.push(
    `| Overall line coverage | \`${bar(overallPct)}\` ${fmt(overallPct)} ` +
      `(${overallCovered}/${overallTotal}) | ${OVERALL_THRESHOLD}% | ${mark(overallOk)} |`,
  )
  if (newTotal === 0) {
    out.push(
      `| New/changed line coverage | no instrumented lines changed | ${NEW_LINE_THRESHOLD}% | ➖ |`,
    )
  } else {
    out.push(
      `| New/changed line coverage | \`${bar(newPct)}\` ${fmt(newPct)} ` +
        `(${newCovered}/${newTotal}) | ${NEW_LINE_THRESHOLD}% | ${mark(newOk)} |`,
    )
  }
  out.push('')

  if (base === null) {
    out.push(
      '> ℹ️ No base ref was resolvable, so the new-line gate was skipped. ' +
        'It runs on pull requests, where the merge base is available.',
    )
    out.push('')
  }

  if (newFiles.length > 0) {
    out.push('<details open>')
    out.push('<summary><b>Coverage of the lines this PR changed</b></summary>')
    out.push('')
    out.push('| File | New lines | Covered | Coverage | Status |')
    out.push('| --- | ---: | ---: | ---: | :---: |')
    for (const entry of newFiles.sort((a, b) => a.pct - b.pct)) {
      out.push(
        `| \`${entry.file}\` | ${entry.total} | ${entry.covered} | ${fmt(entry.pct)} | ` +
          `${mark(entry.pct >= NEW_LINE_THRESHOLD)} |`,
      )
    }
    out.push('')
    out.push('</details>')
    out.push('')
  }

  if (uncoveredNewLines.length > 0) {
    out.push('<details open>')
    out.push('<summary><b>⚠️ New lines with no test coverage</b></summary>')
    out.push('')
    for (const entry of uncoveredNewLines) {
      out.push(`- \`${entry.file}\`: lines ${formatRanges(entry.missing)}`)
    }
    out.push('')
    out.push('</details>')
    out.push('')
  }

  out.push('<details>')
  out.push('<summary><b>Per-file coverage (whole project)</b></summary>')
  out.push('')
  out.push('| File | Lines | Covered | Coverage |')
  out.push('| --- | ---: | ---: | ---: |')
  for (const entry of perFile.sort((a, b) => a.file.localeCompare(b.file))) {
    out.push(`| \`${entry.file}\` | ${entry.total} | ${entry.covered} | ${fmt(entry.pct)} |`)
  }
  out.push('')
  out.push('</details>')
  out.push('')

  if (passed) {
    out.push('### ✅ Both coverage gates passed.')
  } else {
    out.push('### ❌ Coverage gate failed')
    out.push('')
    if (!overallOk) {
      out.push(
        `- Overall line coverage is **${fmt(overallPct)}**, below the required ` +
          `**${OVERALL_THRESHOLD}%**.`,
      )
    }
    if (!newOk) {
      out.push(
        `- Coverage of new/changed lines is **${fmt(newPct)}**, below the required ` +
          `**${NEW_LINE_THRESHOLD}%**. Add tests for the lines listed above before merging.`,
      )
    }
  }
  out.push('')
  out.push(
    `<sub>Thresholds: overall ≥ ${OVERALL_THRESHOLD}%, new lines ≥ ${NEW_LINE_THRESHOLD}%.` +
      `${base ? ` Compared against \`${base.ref}\` (${base.sha.slice(0, 7)}).` : ''}</sub>`,
  )

  const markdown = out.join('\n')
  writeFileSync(outFile, markdown)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`)
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `overall=${overallPct.toFixed(2)}`,
        `new_lines=${newTotal === 0 ? 'n/a' : newPct.toFixed(2)}`,
        `passed=${passed}`,
      ].join('\n') + '\n',
    )
  }

  console.log(markdown)

  if (!passed) {
    console.error('\nCoverage gate failed.')
    process.exit(1)
  }
}

/** Collapses [1,2,3,7] into "1-3, 7" so long lists stay readable. */
function formatRanges(numbers) {
  const ranges = []
  let start = numbers[0]
  let previous = numbers[0]
  for (const value of numbers.slice(1)) {
    if (value === previous + 1) {
      previous = value
      continue
    }
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`)
    start = value
    previous = value
  }
  ranges.push(start === previous ? `${start}` : `${start}-${previous}`)
  return ranges.join(', ')
}

main()
