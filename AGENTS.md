# Project Agent Instructions

## Project Summary

Obsidian plugin for chatting with the Pi coding agent inside Obsidian. Communicates via Pi's RPC mode (`pi --mode rpc --no-session`), exchanging JSON lines over stdin/stdout. Renders conversations as native Obsidian markdown with full support for code highlighting, Mermaid diagrams, callouts, and wiki-links. Desktop-only (no mobile support).

## Tech Stack

- **Language:** TypeScript 5.8
- **Runtime:** Node.js (for spawning Pi subprocess), Obsidian app (desktop)
- **Framework:** Obsidian Plugin API (`obsidian` package)
- **Package Manager:** npm
- **Build Tool:** esbuild 0.25.5
- **Test Tool:** vitest 4.1.5
- **Lint/Format/Typecheck:** TypeScript compiler (`tsc -noEmit -skipLibCheck`) — no ESLint or Prettier found
- **Major Libraries:** `obsidian` (Obsidian Plugin API), `child_process` (spawn Pi), `readline` (JSON line parsing)

## Repository Structure

```
obsidian-pi-plugin/
├── src/                      # Source code (TypeScript)
│   ├── main.ts              # Plugin entry point (PiPlugin class)
│   ├── rpc.ts               # PiConnection — spawns Pi, JSON line protocol
│   ├── view.ts              # PiChatView — chat UI, message rendering
│   ├── stream-handler.ts    # Process RPC events into ChatMessages
│   ├── renderer.ts          # Render messages as Obsidian markdown
│   ├── settings.ts          # Plugin settings (PiSettingTab)
│   ├── settings.test.ts     # Tests for settings logic
│   ├── input.ts             # Chat input with auto-resize, paste, attachments
│   ├── commands.ts          # Pi command picker and palette registration
│   ├── sessions.ts          # Save/load conversations as markdown vault notes
│   ├── session-scanner.ts   # Read Pi's native .jsonl session files
│   ├── session-panel.ts     # Session browser sidebar
│   ├── session-list.ts      # Session list modal for browsing saved conversations
│   ├── message-store.ts     # Persistent message cache
│   ├── statusbar.ts         # Status bar (model, tokens, cost)
│   ├── attachments.ts       # File attachment picker
│   ├── message-types.ts     # Shared ChatMessage interface
│   └── __mocks__/           # Test mocks
│       └── obsidian.ts      # Mock for obsidian module in tests
├── main.js                  # Production build output (single bundle)
├── styles.css               # Plugin styles (chat UI, message layout)
├── manifest.json            # Obsidian plugin manifest (id, version, minAppVersion)
├── versions.json            # Obsidian version compatibility map
├── esbuild.config.mjs       # esbuild configuration (dev watch, prod build)
├── tsconfig.json            # TypeScript configuration
├── vitest.config.ts         # vitest test configuration
├── package.json             # npm scripts, dependencies
├── README.md                # Documentation (setup, architecture, commands)
└── data.json                # Plugin data (user settings, message store) — gitignored
```

## Common Commands

```bash
# install dependencies
npm install

# development (watch mode with inline sourcemap)
npm run dev

# production build (typecheck + bundle, no sourcemap)
npm run build

# run tests
npm test

# run tests in watch mode
npm run test:watch
```

## Coding Conventions

### TypeScript Style
- **Strict mode:** `noImplicitAny: true`, `strictNullChecks: true` in tsconfig.json
- **Module format:** ESNext modules, ES6 target, bundled by esbuild
- **Imports:** Named imports from Obsidian API (`import { Plugin, Notice } from "obsidian"`)
- **Interfaces:** Used for data structures (`ChatMessage`, `PiPluginSettings`, `RpcEvent`)

### Code Organization
- **Classes:** Each module exports a single primary class (`PiPlugin`, `PiConnection`, `PiChatView`, `StreamHandler`, `MessageRenderer`, `SessionManager`, etc.)
- **Separation of concerns:** RPC protocol (`rpc.ts`), UI (`view.ts`), rendering (`renderer.ts`), settings (`settings.ts`)
- **Event-driven:** RPC events dispatched via handlers (`onEvent`, `onDisconnect`)
- **Callbacks pattern:** `StreamHandler` uses callbacks object (`onMessageUpdate`, `onMessageComplete`, `onToolResult`)

### Testing Style
- **Framework:** vitest (`describe`, `it`, `expect`, `vi`)
- **Mocking:** Module mocks in `src/__mocks__/obsidian.ts` for Obsidian API
- **Location:** Test files co-located with source (`settings.test.ts` next to `settings.ts`)
- **Patterns:** Helper functions extracted for testing, descriptive test names

### Obsidian Plugin Patterns
- **Entry point:** `Plugin` subclass with `async onload()` and `async onunload()`
- **Settings:** `PluginSettingTab` with `Setting` UI components
- **Views:** `ItemView` subclass registered via `registerView()`
- **Commands:** `addCommand()` for command palette entries
- **Data persistence:** `loadData()` / `saveData()` for plugin settings, `SecretStorage` for API keys

### Documentation
- **Module headers:** Each source file has a descriptive comment explaining purpose
- **Architecture docs:** README includes Mermaid diagram and module table
- **Inline comments:** Explain non-obvious logic (e.g., "GUI apps on macOS don't inherit shell PATH")

## Project-Specific Rules

### File Locations
- **New UI components:** Add to `src/` with clear purpose (e.g., `src/new-feature.ts`)
- **New settings:** Modify `src/settings.ts` and `PiPluginSettings` interface
- **New RPC events:** Add types to `src/rpc.ts`, handle in `src/stream-handler.ts`
- **New tests:** Co-locate with source file (e.g., `src/new-feature.test.ts`)

### Patterns to Follow
- **RPC communication:** Use `PiConnection.send()` for request/response, `onEvent()` for streaming events
- **Message rendering:** Use `MessageRenderer` class with Obsidian's `MarkdownRenderer.render()`
- **Settings:** Use `Setting` components in `PiSettingTab`, persist via `saveData()`
- **Error handling:** Show `Notice` to user, log to console with `[Pi Plugin]` prefix
- **Async operations:** Use async/await pattern, handle errors gracefully

### Stable APIs
- **ChatMessage interface:** Shared across view, stream-handler, renderer, sessions
- **PiConnection RPC methods:** `send()`, `onEvent()`, `onDisconnect()`, `connect()`, `destroy()`
- **StreamHandler callbacks:** `onMessageUpdate`, `onMessageComplete`, `onToolResult`
- **PiPluginSettings fields:** Changing settings schema requires migration logic

### Testing Requirements
- **Behavior changes:** Add/update tests for settings logic, config parsing, helper functions
- **New RPC event types:** Add unit tests for event handling in stream-handler
- **Mock Obsidian API:** Use `src/__mocks__/obsidian.ts` for tests that depend on Obsidian

### Before Changes
- **Check README:** Review architecture diagram and module table for context
- **Understand RPC protocol:** Read `src/rpc.ts` comments for JSON line protocol details
- **Review existing patterns:** Match class structure, imports, and callbacks patterns
- **Typecheck after changes:** Run `npm run build` to validate types

## Change Workflow

1. **Understand the request.** Read relevant source files and README architecture section.
2. **Inspect existing code.** Check `src/main.ts` for plugin lifecycle, `src/rpc.ts` for protocol, `src/view.ts` for UI patterns.
3. **Plan non-trivial changes.** For new features: identify which modules need modification (RPC, view, renderer, settings).
4. **Make small, focused changes.** Modify one module at a time, follow existing patterns.
5. **Follow project patterns.** Use Obsidian API patterns, TypeScript interfaces, callback-based event handling.
6. **Add tests for logic changes.** Create/update test files for new helper functions, config parsing, or settings logic.
7. **Validate with minimal command.** Run `npm run build` (typecheck) or `npm test` (tests) as appropriate.
8. **Summarize changes.** List modified files, validation run, and any integration risks (e.g., Pi RPC changes).

## Do Not Edit Without Permission

- **`main.js`** — Generated by esbuild, overwritten on every build
- **`data.json`** — User-specific plugin data (settings, message store), gitignored
- **`node_modules/`** — Dependencies, managed by npm
- **`package-lock.json`** — Dependency lockfile, only update when changing dependencies
- **`.gitignore`** — Git exclusions, only modify for new artifacts
- **`manifest.json`** — Plugin metadata, only update for version/release changes
- **`styles.css`** — UI styles, only modify for intentional style changes

## Validation Checklist

Before finishing a task:

- [ ] **Typecheck passes:** `npm run build` succeeds without TypeScript errors
- [ ] **Tests pass:** `npm test` passes all existing tests
- [ ] **Build output exists:** `main.js` generated in repo root
- [ ] **No new runtime dependencies:** `package.json` dependencies unchanged (unless intentional)
- [ ] **Obsidian API usage correct:** Imports from `obsidian` match API patterns
- [ ] **RPC protocol respected:** No changes to JSON line format without understanding impact
- [ ] **README updated:** New features documented in architecture section if applicable
