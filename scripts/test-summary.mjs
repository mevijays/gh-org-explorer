#!/usr/bin/env node
/**
 * Renders the vitest JSON reporter output into a GitHub step summary:
 * one row per test suite, every failure spelled out, and a totals line.
 *
 * Exits non-zero when any test failed so the workflow step fails with it.
 */
import { readFileSync, existsSync, appendFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const RESULTS = resolve(process.cwd(), 'test-results/results.json')

function emit(markdown) {
  console.log(markdown)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`)
  }
}

if (!existsSync(RESULTS)) {
  emit('## ❌ Test run\n\nNo test results were produced at `test-results/results.json`.')
  process.exit(1)
}

const report = JSON.parse(readFileSync(RESULTS, 'utf8'))
const total = report.numTotalTests ?? 0
const passed = report.numPassedTests ?? 0
const failed = report.numFailedTests ?? 0
const skipped = (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0)
const durationMs = (report.testResults ?? []).reduce(
  (sum, suite) => sum + Math.max(0, (suite.endTime ?? 0) - (suite.startTime ?? 0)),
  0,
)

const status = failed > 0 ? '❌ FAILED' : '✅ PASSED'
const rate = total === 0 ? 0 : (passed / total) * 100

const out = []
out.push(`## ${status} — unit test run`)
out.push('')
out.push('| Metric | Value |')
out.push('| --- | ---: |')
out.push(`| Total tests | **${total}** |`)
out.push(`| ✅ Passed | **${passed}** |`)
out.push(`| ❌ Failed | **${failed}** |`)
out.push(`| ⏭️ Skipped | **${skipped}** |`)
out.push(`| Pass rate | **${rate.toFixed(2)}%** |`)
out.push(`| Test files | **${(report.testResults ?? []).length}** |`)
out.push(`| Duration | **${(durationMs / 1000).toFixed(2)}s** |`)
out.push('')

out.push('### Per-file results')
out.push('')
out.push('| Status | Test file | Passed | Failed | Skipped | Time |')
out.push('| :---: | --- | ---: | ---: | ---: | ---: |')

for (const suite of report.testResults ?? []) {
  const assertions = suite.assertionResults ?? []
  const suitePassed = assertions.filter((a) => a.status === 'passed').length
  const suiteFailed = assertions.filter((a) => a.status === 'failed').length
  const suiteSkipped = assertions.filter(
    (a) => a.status === 'pending' || a.status === 'todo' || a.status === 'skipped',
  ).length
  const time = Math.max(0, (suite.endTime ?? 0) - (suite.startTime ?? 0)) / 1000
  const name = relative(process.cwd(), suite.name ?? suite.testFilePath ?? 'unknown')
  out.push(
    `| ${suiteFailed > 0 ? '❌' : '✅'} | \`${name}\` | ${suitePassed} | ${suiteFailed} | ` +
      `${suiteSkipped} | ${time.toFixed(2)}s |`,
  )
}
out.push('')

if (failed > 0) {
  out.push('### ❌ Failures')
  out.push('')
  for (const suite of report.testResults ?? []) {
    for (const assertion of suite.assertionResults ?? []) {
      if (assertion.status !== 'failed') continue
      const title = [...(assertion.ancestorTitles ?? []), assertion.title].join(' › ')
      out.push(`<details><summary><code>${title}</code></summary>`)
      out.push('')
      out.push('```')
      out.push((assertion.failureMessages ?? ['No failure message.']).join('\n').slice(0, 3000))
      out.push('```')
      out.push('')
      out.push('</details>')
      out.push('')
    }
  }
} else {
  out.push('> All tests passed. 🎉')
  out.push('')
}

emit(out.join('\n'))
process.exit(failed > 0 ? 1 : 0)
