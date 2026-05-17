# Stable APIs

These interfaces and APIs are shared across multiple modules. Changes require migration logic or coordinated updates.

## ChatMessage Interface
Shared across `view.ts`, `stream-handler.ts`, `renderer.ts`, `sessions.ts`.

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  // ... additional fields
}
```

## PiConnection RPC Methods
Methods in `src/rpc.ts`:
- `send()` — Request/response pattern
- `onEvent()` — Streaming event handler
- `onDisconnect()` — Connection cleanup
- `connect()` — Initialize connection
- `destroy()` — Cleanup and close

## StreamHandler Callbacks
Callback interface in `src/stream-handler.ts`:
- `onMessageUpdate` — Partial message received
- `onMessageComplete` — Full message received
- `onToolResult` — Tool execution result

## PiPluginSettings Fields
Settings interface in `src/settings.ts`. Changing fields requires:
1. Migration logic for existing user data
2. Update to `PiSettingTab` UI
3. Version bump consideration