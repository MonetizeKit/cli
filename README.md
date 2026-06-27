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

## Credential storage

Secrets are stored in the OS keychain via `keytar` when available. `keytar` is an
**optional** native dependency — if it can't be installed/loaded on your
platform, the CLI transparently falls back to a `0600`-permission credentials
file.

## License

MIT
