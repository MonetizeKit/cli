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

## Running the CLI from an autonomous agent

Four global capabilities make the CLI safe and self-describing to drive from
an autonomous coding agent rather than a human at a terminal.

### `--mode agent`: deterministic, non-interactive execution

`--mode agent` forces JSON output and guarantees the CLI never blocks on an
interactive prompt (a confirmation prompt, `auth login`'s browser flow, etc.):
any code path that would otherwise prompt instead exits immediately with code
`2` and a structured error naming the flag that should have supplied the
input non-interactively.

```bash
# Fails fast with a structured error instead of opening a browser
monetizekit auth login --mode agent
# {"schemaVersion":"1.0.0","data":{"error":{"code":"InvalidArguments","message":"auth login requires --key when running non-interactively.","remediation":"Pass --key <mk_...> with the API key created via the web app; this skips the browser/prompt flow."}}}

# Destructive commands require --yes under --mode agent, never a confirmation prompt
monetizekit catalog products delete prod_123 --mode agent --yes
```

`--mode agent` implies `--json`; combining it with `--output table` (or any
non-JSON `--output`) is a usage conflict and exits `2` rather than silently
picking one.

### `--input-json`: one JSON document instead of many flags

Any command that accepts `--input-json` can take its entire parameter set as
a single JSON document — inline, or `-` to read it from stdin — instead of
individual flags/args. This avoids shell-escaping long flag sequences and
gives the same result either way, since both paths are validated against the
same schema.

```bash
monetizekit customers create --input-json '{"externalId":"cust_123","email":"jane@example.com"}'

echo '{"customer":"cust_123","meter":"api_calls","value":42}' \
  | monetizekit usage submit --input-json -
```

Supplying `--input-json` together with the equivalent individual flags/args
is a usage conflict (exit `2`); a document that fails schema validation
exits `7` with every failing field's JSON Pointer path, not just the first.
Discover a command's expected shape on demand:

```bash
monetizekit customers create --input-json-schema
```

`--input-json` is available on: `catalog products/plans/features/addons/meters
create`/`update`, `customers create`/`update`, `entitlements simulate`,
`usage submit`, and `config patch`.

### `config schema` / `config patch`: introspect and mutate the CLI's own config

```bash
# Print the CliConfig JSON Schema
monetizekit config schema

# Apply a JSON Merge Patch (RFC 7396) to the config file, atomically
monetizekit config patch --input-json '{"telemetry":{"enabled":false}}'

# Preview a patch without writing it
monetizekit config patch --input-json '{"activeProfile":"staging"}' --dry-run
```

`config patch` always requires `--input-json` (in both `--mode human` and
`--mode agent`) and validates the patched result against the config schema
before writing; a failing patch leaves the existing config file untouched.
The write itself is atomic (temp file + rename), so a crash mid-write can
never corrupt the config file.

## Credential storage

Secrets are stored in the OS keychain via `keytar` when available. `keytar` is an
**optional** native dependency — if it can't be installed/loaded on your
platform, the CLI transparently falls back to a `0600`-permission credentials
file.

## License

MIT
