# Project Agent Instructions

## Project Summary

Obsidian plugin for chatting with the Pi coding agent inside Obsidian. Communicates via Pi's RPC mode (`pi --mode rpc --no-session`), exchanging JSON lines over stdin/stdout. Renders conversations as native Obsidian markdown with full support for code highlighting, Mermaid diagrams, callouts, and wiki-links. Desktop-only (no mobile support).

## Tech Stack

- **Language:** TypeScript 5.8
- **Runtime:** Node.js (for spawning Pi subprocess), Obsidian app (desktop)
- **Framework:** Obsidian Plugin API (`obsidian` package)
- **Build Tool:** esbuild 0.25.5
- **Test Tool:** vitest 4.1.5

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
│   ├── sessions.ts          # Save/load conversations as markdown vault notes
│   └── __mocks__/           # Test mocks
├── main.js                  # Production build output (single bundle)
├── styles.css               # Plugin styles
├── manifest.json            # Obsidian plugin manifest
└── README.md                # Documentation
```

## Common Commands

```bash
npm install          # install dependencies
npm run dev          # development (watch mode)
npm run build        # production build (typecheck + bundle)
npm test             # run tests
```

## Rules

See `.pi/rules/` for detailed conventions:
- **coding-conventions.md** — Use when writing or editing TypeScript code, organizing modules, adding tests, or documenting source files
- **obsidian-patterns.md** — Use when adding new UI components, settings, commands, RPC events, or working with Obsidian Plugin API
- **stable-apis.md** — Use when modifying ChatMessage interface, PiConnection methods, StreamHandler callbacks, or PiPluginSettings fields
- **workflow.md** — Use before making changes, after completing changes, or when unsure about the change process or validation steps
- **graphify-usage.md** — Use Graphify as an orientation tool for unfamiliar repos, architecture review, cross-file refactors, dependency/call-chain tracing, or command/workflow/skill/plugin wiring. Do not use it as a default step for small localized edits.
