# Changelog

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
