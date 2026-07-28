# @monetizekit/cli

The [MonetizeKit](https://monetizekit.app) command-line interface (`monetizekit`,
aliased `mk`) for catalog management, entitlement & usage operations,
diagnostics, and CI integration. Built on [oclif](https://oclif.io).

## Install

```bash
npm install -g @monetizekit/cli
# or run without installing:
npx @monetizekit/cli --help
```

## Usage

```bash
# Authenticate (stores the API key in your OS keychain, with a 0600 file fallback)
monetizekit auth login

# Inspect the catalog
monetizekit catalog plans
monetizekit catalog diff

# Operate on customers and entitlements
monetizekit customers list
monetizekit entitlements explain --customer cust_123 --feature api_access

# CI helpers
monetizekit ci contract-test
monetizekit doctor run
```

Run `monetizekit --help` to see all topics and commands, or
`monetizekit <topic> <command> --help` for command-specific flags.

## Project scaffolding (`monetizekit init`)

`monetizekit init` scaffolds MonetizeKit integration files into the current
project. It always writes the additive `.monetizekit/` files (README, `.env.example`,
an SDK usage example, and — with `--stripe` — a Stripe webhook-signature
example). For **Next.js** and **Node** projects (where `@monetizekit/react`/
`@monetizekit/node` are real, published SDKs) it additionally performs *deep
scaffolding*: AST-aware edits to your actual application source, run in this
order:

1. **Provider wrap** — wraps your Next.js App Router root layout
   (`app/layout.tsx` or `src/app/layout.tsx`) in `<MonetizeKitProvider>` from
   `@monetizekit/react`.
2. **Middleware** — creates `middleware.ts`/`src/middleware.ts` (or merges
   into an existing one) with a marked MonetizeKit block.
3. **Webhook route** — scaffolds a real webhook endpoint
   (`app/api/webhooks/monetizekit/route.ts` for Next.js, an Express router
   file for Node) implementing HMAC-SHA256 signature verification.
4. **Protected example** — scaffolds a runnable entitlement-gated
   page/module (e.g. `app/monetizekit-example/page.tsx`) using a
   `"REPLACE_WITH_YOUR_FEATURE_KEY"` placeholder.

Every deep-scaffolding step is idempotent and fails closed: re-running
`monetizekit init` reports already-applied steps as `already-present` and
makes no further edits, and any file shape the codemod can't confidently
handle (e.g. an unrecognized layout or `matcher` config) is skipped with a
`reason` rather than guessed at. Projects without a MonetizeKit SDK (`go`,
`python`, `java`, or unrecognized projects) fall back to the `.monetizekit/`-only
behavior, and the command prints which SDK would unlock deep scaffolding for
that project type.

The command's JSON result (`--json`) includes `deepScaffoldSupported` and a
`steps` array, one entry per deep-scaffolding step, each reporting
`status: "applied" | "already-present" | "skipped"` (with a `reason` when
skipped) — never a bare boolean.

Use `--dry-run` to preview every file `monetizekit init` would create or edit
(both the `.monetizekit/` files and the deep-scaffolding steps above) as
unified diffs, without writing anything to disk:

```bash
monetizekit init --dry-run
```

## Credential storage

Secrets are stored in the OS keychain via `keytar` when available. `keytar` is an
**optional** native dependency — if it can't be installed/loaded on your
platform, the CLI transparently falls back to a `0600`-permission credentials
file.

## License

MIT
