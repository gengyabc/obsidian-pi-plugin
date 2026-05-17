# Coding Conventions

## TypeScript Style
- **Strict mode:** `noImplicitAny: true`, `strictNullChecks: true`
- **Module format:** ESNext modules, ES6 target, bundled by esbuild
- **Imports:** Named imports from Obsidian API (`import { Plugin, Notice } from "obsidian"`)
- **Interfaces:** Used for data structures (`ChatMessage`, `PiPluginSettings`, `RpcEvent`)

## Code Organization
- **Classes:** Each module exports a single primary class (`PiPlugin`, `PiConnection`, `PiChatView`, `StreamHandler`, `MessageRenderer`, `SessionManager`)
- **Separation of concerns:** RPC protocol (`rpc.ts`), UI (`view.ts`), rendering (`renderer.ts`), settings (`settings.ts`)
- **Event-driven:** RPC events dispatched via handlers (`onEvent`, `onDisconnect`)
- **Callbacks pattern:** `StreamHandler` uses callbacks object (`onMessageUpdate`, `onMessageComplete`, `onToolResult`)

## Testing
- **Framework:** vitest (`describe`, `it`, `expect`, `vi`)
- **Mocking:** Module mocks in `src/__mocks__/obsidian.ts` for Obsidian API
- **Location:** Test files co-located with source (`settings.test.ts` next to `settings.ts`)
- **Patterns:** Helper functions extracted for testing, descriptive test names

## Documentation
- **Module headers:** Each source file has a descriptive comment explaining purpose
- **Architecture docs:** README includes Mermaid diagram and module table
- **Inline comments:** Explain non-obvious logic (e.g., "GUI apps on macOS don't inherit shell PATH")