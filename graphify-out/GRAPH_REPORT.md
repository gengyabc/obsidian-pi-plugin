# Graph Report - /Users/yugeng/programming/obsidian-pi-plugin  (2026-05-17)

## Corpus Check
- 47 files · ~82,395 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1203 nodes · 1798 edges · 49 communities (34 shown, 15 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.75)
- Token cost: 25,000 input · 3,500 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Pi Sessions|Pi Sessions]]
- [[_COMMUNITY_Pi Commands|Pi Commands]]
- [[_COMMUNITY_Commands Registry|Commands Registry]]
- [[_COMMUNITY_Build Bundle|Build Bundle]]
- [[_COMMUNITY_Chat View|Chat View]]
- [[_COMMUNITY_Model Config|Model Config]]
- [[_COMMUNITY_Connection Lifecycle|Connection Lifecycle]]
- [[_COMMUNITY_RPC Events|RPC Events]]
- [[_COMMUNITY_Obsidian Modals|Obsidian Modals]]
- [[_COMMUNITY_Session State|Session State]]
- [[_COMMUNITY_Package Config|Package Config]]
- [[_COMMUNITY_Message Display|Message Display]]
- [[_COMMUNITY_Plugin Core|Plugin Core]]
- [[_COMMUNITY_Chat Input|Chat Input]]
- [[_COMMUNITY_Plugin Lifecycle|Plugin Lifecycle]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Stream Handler|Stream Handler]]
- [[_COMMUNITY_Plugin Data|Plugin Data]]
- [[_COMMUNITY_Message Conversion|Message Conversion]]
- [[_COMMUNITY_Session Manager|Session Manager]]
- [[_COMMUNITY_Message Types|Message Types]]
- [[_COMMUNITY_Permission Dialogs|Permission Dialogs]]
- [[_COMMUNITY_Session Sidebar|Session Sidebar]]
- [[_COMMUNITY_Detection Cache|Detection Cache]]
- [[_COMMUNITY_RPC Connection|RPC Connection]]
- [[_COMMUNITY_Localization|Localization]]
- [[_COMMUNITY_Command Picker|Command Picker]]
- [[_COMMUNITY_Attachment Picker|Attachment Picker]]
- [[_COMMUNITY_Session Panel|Session Panel]]
- [[_COMMUNITY_Message Store|Message Store]]
- [[_COMMUNITY_Session List|Session List]]
- [[_COMMUNITY_Status Bar|Status Bar]]
- [[_COMMUNITY_Session Loading|Session Loading]]
- [[_COMMUNITY_Stream Control|Stream Control]]
- [[_COMMUNITY_Plugin Manifest|Plugin Manifest]]
- [[_COMMUNITY_Message Renderer|Message Renderer]]
- [[_COMMUNITY_Rewind Design|Rewind Design]]
- [[_COMMUNITY_Command Modal|Command Modal]]
- [[_COMMUNITY_Model Switcher|Model Switcher]]
- [[_COMMUNITY_Plugin Architecture|Plugin Architecture]]
- [[_COMMUNITY_RPC Protocol|RPC Protocol]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_OpenCode Config|OpenCode Config]]
- [[_COMMUNITY_v0.2 Features|v0.2 Features]]
- [[_COMMUNITY_Secret Storage|Secret Storage]]

## God Nodes (most connected - your core abstractions)
1. `sessions` - 175 edges
2. `PiChatView` - 64 edges
3. `t()` - 50 edges
4. `send()` - 24 edges
5. `PiPlugin` - 23 edges
6. `switchToSession()` - 19 edges
7. `ChatInput` - 19 edges
8. `newSessionFromHeader()` - 18 edges
9. `isConnected()` - 17 edges
10. `StreamHandler` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Session Management System` --semantically_similar_to--> `Rewind Fork Semantics`  [INFERRED] [semantically similar]
  README.md → docs/2026-05-08-rewind-plan.md
- `Load vs Reload Message Distinction` --rationale_for--> `Rewind Fork Semantics`  [EXTRACTED]
  docs/2026-05-08-plan-QA.md → docs/2026-05-08-rewind-plan.md
- `Return Banner Position Design` --rationale_for--> `Return to Latest Feature`  [EXTRACTED]
  docs/2026-05-08-plan-QA.md → docs/2026-05-08-rewind-plan.md
- `Checkpoint Persistence Decision` --rationale_for--> `Return to Latest Feature`  [EXTRACTED]
  docs/2026-05-08-plan-QA.md → docs/2026-05-08-rewind-plan.md

## Hyperedges (group relationships)
- **Rewind Feature Design** — rewind_fork_semantics, rewind_return_latest, rewind_entry_id_sync, qa_load_vs_reload [EXTRACTED 0.90]
- **Plugin Architecture Pattern** — agents_plugin_pattern, agents_event_driven, agents_callbacks_pattern [EXTRACTED 0.95]

## Communities (49 total, 15 thin omitted)

### Community 0 - "Pi Sessions"
Cohesion: 0.01
Nodes (175): sessions, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T11-28-51-752Z_019e263f-2027-729d-86e4-050bc704483c.jsonl, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T11-38-21-525Z_019e2647-d1d4-7370-9591-58212efdd1ca.jsonl, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T11-40-14-509Z_019e2649-8b2c-76ab-ac53-524b59217c63.jsonl, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T12-42-06-811Z_019e2682-305b-76b4-a476-e14eb8849435.jsonl, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T12-51-19-059Z_019e268a-9d92-7027-9181-2a13abd565cd.jsonl, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T12-59-13-059Z_019e2691-d922-7785-8c4d-6d02c99b53bd.jsonl, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T13-13-31-974Z_019e269e-f446-774c-80fb-16bcb7be4e96.jsonl (+167 more)

### Community 1 - "Pi Commands"
Cohesion: 0.01
Nodes (173): attachment.attached, attachment.imagesAttached, commands.browseSessions, commands.newSession, commands.openChat, commands.piPrefix, commands.saveSession, commands.sendPrompt (+165 more)

### Community 2 - "Commands Registry"
Cohesion: 0.01
Nodes (164): attachment.attached, attachment.imagesAttached, commands.browseSessions, commands.newSession, commands.openChat, commands.saveSession, commands.sendPrompt, commands.switchModel (+156 more)

### Community 3 - "Build Bundle"
Cohesion: 0.05
Nodes (39): addActionButton(), addAttachment(), browseSessions(), buildSessionEntries(), cancelRewindAfterExtensionUi(), childProcessModule, clearAttachments(), ensureDirectory() (+31 more)

### Community 5 - "Model Config"
Cohesion: 0.07
Nodes (21): getProviderEnvVarName(), getProviderModels(), ModelInfo, PiModelConfig, PiModelsJson, PiProviderConfig, ProviderInfo, readPiModelsConfig() (+13 more)

### Community 6 - "Connection Lifecycle"
Cohesion: 0.09
Nodes (32): cleanup(), confirmDelete(), connect(), createConnection(), createNodePathSetting(), createPiBinaryPathSetting(), createProviderModelSettings(), destroy() (+24 more)

### Community 7 - "RPC Events"
Cohesion: 0.07
Nodes (20): AgentEndEvent, AgentStartEvent, AssistantMessageEvent, AutoCompactionEndEvent, ChildProcess, childProcessModule, EventHandler, MessageEndEvent (+12 more)

### Community 8 - "Obsidian Modals"
Cohesion: 0.08
Nodes (6): App, Modal, Platform, PluginSettingTab, SecretComponent, Setting

### Community 9 - "Session State"
Cohesion: 0.17
Nodes (25): autoSave(), clearMessages(), getActiveView(), getPiState(), handleDisconnect(), hasMessages(), hide(), isConnected() (+17 more)

### Community 10 - "Package Config"
Cohesion: 0.08
Nodes (24): author, description, devDependencies, esbuild, eslint, @eslint/json, eslint-plugin-obsidianmd, obsidian (+16 more)

### Community 11 - "Message Display"
Cohesion: 0.18
Nodes (24): addMessage(), appendMessage(), displayMessages(), focus(), getMessages(), handleStreamComplete(), loadMessagesFromPi(), normalizePromptText() (+16 more)

### Community 14 - "Plugin Lifecycle"
Cohesion: 0.12
Nodes (17): applyModelSelection(), constructor(), load(), loadMessageStore(), loadSettings(), looksLikeMarkdown(), onload(), refreshSessionName() (+9 more)

### Community 15 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, importHelpers, inlineSourceMap, inlineSources, isolatedModules (+8 more)

### Community 17 - "Plugin Data"
Cohesion: 0.13
Nodes (14): apiKeys, apiSecretNames, defaultModel, defaultProvider, envVars, messageStore, lastSession, nodePath (+6 more)

### Community 18 - "Message Conversion"
Cohesion: 0.18
Nodes (15): buildCurrentMessage(), convertAgentMessage(), exportSession(), extractMessageText(), extractResultText(), extractTextFromMessage(), extractThinkingFromMessage(), generateMessageId() (+7 more)

### Community 20 - "Message Types"
Cohesion: 0.24
Nodes (9): ChatMessage, generateMessageId(), showCriticalNotice(), StreamCallbacks, ContentBlock, ExtensionUiRequest, ForkMessage, PiStateData (+1 more)

### Community 21 - "Permission Dialogs"
Cohesion: 0.14
Nodes (4): PermissionConfirmModal, PermissionInputModal, PermissionResponse, PermissionSelectModal

### Community 22 - "Session Sidebar"
Cohesion: 0.2
Nodes (7): SessionPanelCallbacks, ContentBlock, fsPromisesModule, osModule, pathModule, PiSession, SessionScanner

### Community 23 - "Detection Cache"
Cohesion: 0.15
Nodes (12): files, code, document, image, paper, video, graphifyignore_patterns, needs_graph (+4 more)

### Community 24 - "RPC Connection"
Cohesion: 0.17
Nodes (13): buildHeaderBar(), connectToRpc(), fetchCommands(), getCommands(), getInputAreaEl(), offEvent(), onEvent(), onOpen() (+5 more)

### Community 25 - "Localization"
Cohesion: 0.19
Nodes (6): currentLang, escapeRegex(), LocaleModule, locales, t(), UserMessageActions

### Community 26 - "Command Picker"
Cohesion: 0.22
Nodes (5): CommandSuggest, PiCommand, DesktopVaultAdapter, ModelOption, MessageStoreData

### Community 27 - "Attachment Picker"
Cohesion: 0.17
Nodes (4): AttachmentPicker, FileSuggestModal, Attachment, ChatInputCallbacks

### Community 30 - "Session List"
Cohesion: 0.22
Nodes (5): buildSessionEntries(), extractPreview(), formatFileDate(), SessionEntry, SessionListModal

### Community 32 - "Session Loading"
Cohesion: 0.2
Nodes (10): activateView(), loadSession(), loadSessionEntry(), newSession(), parseConversation(), parseToolName(), sendPiCommand(), startNewSession() (+2 more)

### Community 33 - "Stream Control"
Cohesion: 0.27
Nodes (10): abortStream(), autoResize(), commitSessionNameEdit(), ensureConnection(), fetchForkMessages(), handleKeydown(), send(), sendMessage() (+2 more)

### Community 34 - "Plugin Manifest"
Cohesion: 0.25
Nodes (7): author, description, id, isDesktopOnly, minAppVersion, name, version

### Community 36 - "Rewind Design"
Cohesion: 0.29
Nodes (7): Return Banner Position Design, Checkpoint Persistence Decision, Load vs Reload Message Distinction, Session Management System, Entry ID Sync Mechanism, Rewind Fork Semantics, Return to Latest Feature

### Community 39 - "Plugin Architecture"
Cohesion: 0.67
Nodes (3): Callbacks Pattern, Event-Driven Architecture, Plugin Entry Point Pattern

### Community 40 - "RPC Protocol"
Cohesion: 0.67
Nodes (3): Command Integration, JSON Line Protocol, RPC Mode Communication

## Knowledge Gaps
- **639 isolated node(s):** `code`, `document`, `paper`, `image`, `video` (+634 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PiChatView` connect `Chat View` to `Command Picker`, `Message Types`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `sessions` connect `Pi Sessions` to `Plugin Data`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `SessionManager` connect `Session Manager` to `Command Picker`, `Message Types`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `code`, `document`, `paper` to the rest of the system?**
  _651 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Pi Sessions` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._
- **Should `Pi Commands` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._
- **Should `Commands Registry` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._