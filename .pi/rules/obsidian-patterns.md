# Obsidian Plugin Patterns

## Plugin Lifecycle
- **Entry point:** `Plugin` subclass with `async onload()` and `async onunload()`
- **Settings:** `PluginSettingTab` with `Setting` UI components
- **Views:** `ItemView` subclass registered via `registerView()`
- **Commands:** `addCommand()` for command palette entries
- **Data persistence:** `loadData()` / `saveData()` for plugin settings, `SecretStorage` for API keys

## File Locations
- **New UI components:** Add to `src/` with clear purpose (e.g., `src/new-feature.ts`)
- **New settings:** Modify `src/settings.ts` and `PiPluginSettings` interface
- **New RPC events:** Add types to `src/rpc.ts`, handle in `src/stream-handler.ts`
- **New tests:** Co-locate with source file (e.g., `src/new-feature.test.ts`)

## Patterns to Follow
- **RPC communication:** Use `PiConnection.send()` for request/response, `onEvent()` for streaming events
- **Message rendering:** Use `MessageRenderer` class with Obsidian's `MarkdownRenderer.render()`
- **Settings:** Use `Setting` components in `PiSettingTab`, persist via `saveData()`
- **Error handling:** Show `Notice` to user, log to console with `[Pi Plugin]` prefix
- **Async operations:** Use async/await pattern, handle errors gracefully