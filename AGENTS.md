# AGENTS.md

## Project overview

`@monetizekit/cli`: oclif command-line interface for MonetizeKit. Commands in
`src/commands/`, tests in Vitest (`vitest.config.ts`), built with `tsc` plus
`oclif manifest`. Tarballs and a Homebrew formula are produced by
`pack:tarballs` and `pack:homebrew`.

## Commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`, `pnpm test`, `pnpm build`
- `pnpm smoke` (runs the built binary: `--version` and `--help`)
- `pnpm dev -- <command>` runs from source via `tsx`

## Conventions

- Every command has a test under `test/` that exercises its flags and error
  paths without network; live API calls are behind an explicit fixture.
- Never print a secret key in full; the CLI masks keys the way the dashboard
  does.
- New or changed commands need a changeset and regenerate `oclif.manifest.json`
  through `pnpm build` (do not edit it by hand).

## Verifying your work

```
$ pnpm typecheck
(no output, exit 0)

$ pnpm test
 Test Files  30 passed (30)
      Tests  94 passed (94)

$ pnpm build
wrote manifest to <repo>/oclif.manifest.json

$ pnpm smoke
@monetizekit/cli/0.1.0 linux-x64 node-v22.x
```

## Releasing

Published to npm by Changesets from `.github/workflows/release.yml` on push to
`main`, with npm provenance. Add a changeset (`pnpm changeset`) to any PR that
changes the published surface. Because `main` only receives promotions from
`delivery`, a release is the result of a promotion, not of a feature merge.

## SDLC and promotion chain

- Branches: `feature/*` -> PR -> `development` -> `delivery` -> `main`. Feature
  PRs target `development`. Promotion between stages is a promotion PR from
  the upstream stage branch (`development -> delivery`, `delivery -> main`);
  where this repository has `.github/workflows/promote.yml`, that workflow
  opens it when the stage gate is green, and `delivery -> main` is always
  merged by a human. Never open a feature PR against `main` or `delivery`.
- Every PR must pass the `Required Checks Gate` job in `.github/workflows/ci.yml`.
  The `Shadow Review (advisory)` job posts a model review comment; it never
  blocks. React with a thumbs-down to dismiss a finding.
- Agent roles, model IDs, tools and autonomy for the whole fleet are declared in
  [`MonetizeKit/.github/agent-policy.json`](https://github.com/MonetizeKit/.github/blob/main/agent-policy.json).
  Never hardcode a model ID in this repository.
- Conventional commits (`feat:`, `fix:`, `chore:`, ...). Position and status live
  in Linear (team `MK`); reference the issue key in the PR body when one exists.
- The fleet-wide plan is
  [`docs/engineering/ai-native-sdlc-plan.md`](https://github.com/MonetizeKit/app-monetizekit-monorepo/blob/main/docs/engineering/ai-native-sdlc-plan.md)
  in the monorepo.
