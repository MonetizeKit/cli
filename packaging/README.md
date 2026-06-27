# MonetizeKit CLI packaging

## npm global install

```
npm install -g @monetizekit/cli
```

## Build standalone tarballs

```
pnpm --filter @monetizekit/cli run pack:tarballs
```

Targets:
- `linux-x64`
- `linux-arm64`
- `darwin-x64`
- `darwin-arm64`
- `win32-x64`

## Generate Homebrew formula template

```
pnpm --filter @monetizekit/cli run pack:homebrew
```

Generated file:
- `packages/cli/packaging/homebrew/monetizekit.rb`

Update the SHA256 placeholders before publishing.
