# GitHub Org Explorer

A React + TypeScript single-page app that talks to the GitHub REST API with a
personal access token you supply in the browser. It lists the organizations
your token can see, browses their repositories, and performs a few basic
operations against them.

The token never leaves your browser except in the `Authorization` header of
requests to `api.github.com`; it is kept in `localStorage` so a reload does not
lose your session.

## Features

- Connect with a classic (`ghp_…`) or fine-grained (`github_pat_…`) token
- List every organization the token can read, with avatars and descriptions
- Browse an org's repositories, with filter (name, language, description,
  topic) and sort (recently updated, stars, name)
- Aggregate stats per org: repo count, total stars, forks, open issues,
  languages in use
- Per-repository operations:
  - **Star / unstar** — `PUT`/`DELETE /user/starred/{owner}/{repo}`
  - **List branches** — with `protected` and `default` badges
  - **Create an issue** — title and body
  - **Edit the description** — `PATCH /repos/{owner}/{repo}`
  - **Replace topics** — `PUT /repos/{owner}/{repo}/topics`

### Token scopes

| Scope | Needed for |
| --- | --- |
| `read:org` | Listing organizations |
| `repo` | Private repos, creating issues, editing metadata |
| `public_repo` | Starring public repos (a subset of `repo`) |

## Getting started

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and produce `dist/` |
| `npm run lint` | `tsc --noEmit` across the project |
| `npm test` | Run the vitest suite once |
| `npm run coverage` | Run the suite with v8 coverage |
| `npm run coverage:check` | Evaluate the coverage gates locally |

## Testing

Vitest with the v8 coverage provider, jsdom, and Testing Library. Tests never
touch the network: `src/test/factories.ts` provides a `stubFetch` helper that
answers from a path → response map, and the `GitHubClient` takes a `fetch`
implementation in its constructor.

Check the gates the way CI does:

```bash
npm run coverage && node scripts/coverage-report.mjs --base main
```

## Coverage gates

Two thresholds are enforced on every pull request:

| Gate | Threshold | Why |
| --- | --- | --- |
| Overall line coverage | **≥ 80%** | Baseline health of the whole project |
| New / changed line coverage | **≥ 90%** | Shift left — untested new code fails fast |

The new-line gate is what makes this shift left. A large, well-covered codebase
can otherwise absorb an entirely untested new file without the overall number
moving noticeably, so `scripts/coverage-report.mjs` diffs against the PR's merge
base, maps the added lines onto the v8 coverage data, and reports the coverage
of just those lines — naming the exact uncovered line ranges in the PR comment.

Both thresholds are configurable through `COVERAGE_OVERALL_THRESHOLD` and
`COVERAGE_NEW_LINE_THRESHOLD` in `.github/workflows/pr-checks.yml`.

## Workflows

### `PR checks` — on pull request

Runs on every PR against `main`.

1. Checks out with full history (needed for the merge-base diff)
2. Type-checks, then runs the tests with coverage
3. Evaluates both gates and writes a markdown report
4. Posts the report as a PR comment, updating the same comment on each push
   instead of piling new ones up
5. Fails the check if either gate is not met
6. Builds the production bundle in parallel and reports its size

### `Build and publish image` — on workflow dispatch

Inputs: `image_tag` (defaults to the short SHA), `push_image` (uncheck for a
build-only dry run), and `platforms`.

1. **test** — runs the suite and writes a per-file pass/fail table plus totals
   (total, passed, failed, skipped, pass rate, duration) into the step summary
2. **build-and-push** — builds `dist/`, packages it as a `.tar.gz` artifact,
   builds the Docker image and pushes it to
   `ghcr.io/<owner>/artifact:<tag>` (plus `:latest`)
3. Writes a final step summary with the test totals, the artifact details, and
   the published image reference and digest

On a dry run the image is built and loaded locally, then smoke-tested by
starting the container and curling `/healthz`.

## Docker

Multi-stage: Node 22 Alpine builds the bundle, nginx 1.27 Alpine serves it on
port 8080 with SPA fallback, a `/healthz` endpoint, gzip and long-lived cache
headers on hashed assets.

```bash
docker build -t gh-org-explorer .
docker run --rm -p 8080:8080 gh-org-explorer
# http://localhost:8080
```

Or pull the published image:

```bash
docker pull ghcr.io/mevijays/artifact:latest
docker run --rm -p 8080:8080 ghcr.io/mevijays/artifact:latest
```

## Project layout

```
src/
  lib/          github.ts (API client), format.ts, storage.ts, errors.ts, types.ts
  hooks/        useGitHub.ts — all app state and API orchestration
  components/   TokenForm, OrgList, RepoList, RepoToolbar, RepoDetail, StatsBar
  test/         setup.ts, factories.ts (fixtures + stubFetch)
scripts/
  coverage-report.mjs   coverage gates, PR comment, step summary
  test-summary.mjs      test results table for the step summary
docker/nginx.conf
```

## License

MIT
