# Changelog

## [0.2.8] - 2026-07-08

### Changed
- Switched model/API key settings to a declarative settings definition pattern
- Enabled shell spawn support for non-ASCII Pi binary paths
- Added JSON5 parsing for Pi `models.json` to support trailing commas
- Bundled `json5` and synced thinking level on connect and live settings changes
- Improved graph/documentation tooling for repository analysis

### Fixed
- Propagated thinking level to Pi on startup and while settings change
- Stripped leading `$` from Pi model API key environment variable names
- Resolved unsafe JSON parsing and `@typescript-eslint/no-unsafe-*` warnings across source files

### Chore
- Bumped version to 0.2.8

## [0.2.0] - 2026-05-15

### Added
- English and Chinese localization support (`i18n`)
- Obsidian modals for permission dialogs
- Animated thinking indicator while waiting for Pi responses
- Native text selection for chat messages

### Changed
- Popout window compatibility for chat view
- Simplified API key handling via `SecretStorage`

### Fixed
- Code review issues: popout compat, type safety, dead code removal
- ESLint warnings across all source files
- Obsidian ESLint rule violations (accessibility, lifecycle, type safety)
- ESLint and TypeScript warnings
- Secret loading and locale imports
- Critical errors surfaced with sticky notices
- Async `SecretStorage` calls and intentional exit error suppression
- vitest 4.x compatibility: updated `@types/node` and `esbuild`

### Chore
- Bumped version to 0.2.0
- Removed redundant `versions.json`
- Added MIT LICENSE
