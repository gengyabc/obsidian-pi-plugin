# Graph Report - obsidian-pi-plugin  (2026-06-11)

## Corpus Check
- 26 files · ~22,280 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1184 nodes · 1786 edges · 46 communities (31 shown, 15 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `16ff0c6a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 48|Community 48]]

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

## Communities (46 total, 15 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (175): sessions, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T11-28-51-752Z_019e263f-2027-729d-86e4-050bc704483c.jsonl, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T11-38-21-525Z_019e2647-d1d4-7370-9591-58212efdd1ca.jsonl, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T11-40-14-509Z_019e2649-8b2c-76ab-ac53-524b59217c63.jsonl, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T12-42-06-811Z_019e2682-305b-76b4-a476-e14eb8849435.jsonl, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T12-51-19-059Z_019e268a-9d92-7027-9181-2a13abd565cd.jsonl, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T12-59-13-059Z_019e2691-d922-7785-8c4d-6d02c99b53bd.jsonl, /Users/yugeng/.pi/agent/sessions/--Users-yugeng-Library-CloudStorage-OneDrive-sziit.edu.cn-Documents--/2026-05-14T13-13-31-974Z_019e269e-f446-774c-80fb-16bcb7be4e96.jsonl (+167 more)

### Community 1 - "Community 1"
Cohesion: 0.01
Nodes (173): attachment.attached, attachment.imagesAttached, commands.browseSessions, commands.newSession, commands.openChat, commands.piPrefix, commands.saveSession, commands.sendPrompt (+165 more)

### Community 2 - "Community 2"
Cohesion: 0.01
Nodes (164): attachment.attached, attachment.imagesAttached, commands.browseSessions, commands.newSession, commands.openChat, commands.saveSession, commands.sendPrompt, commands.switchModel (+156 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (50): activateView(), addAttachment(), appendMessage(), browseSessions(), buildSessionEntries(), cancelRewindAfterExtensionUi(), childProcessModule, clearAttachments() (+42 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (25): getProviderEnvVarName(), getProviderModels(), ModelInfo, PiModelConfig, PiModelsJson, PiProviderConfig, ProviderInfo, readPiModelsConfig() (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (29): buildHeaderBar(), commitSessionNameEdit(), confirmDelete(), connectToRpc(), createConnection(), createNodePathSetting(), createPiBinaryPathSetting(), display() (+21 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (18): AgentEndEvent, AgentStartEvent, AssistantMessageEvent, AutoCompactionEndEvent, ChildProcess, childProcessModule, EventHandler, MessageEndEvent (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (6): App, Modal, Platform, PluginSettingTab, SecretComponent, Setting

### Community 9 - "Community 9"
Cohesion: 0.21
Nodes (13): autoSave(), cleanup(), connect(), destroy(), flushMessageStore(), getActiveView(), hasMessages(), isDirty() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.21
Nodes (29): applyModelSelection(), autoResize(), fetchForkMessages(), getPiState(), isConnected(), loadMessagesFromPi(), newSessionFromHeader(), refreshHeader() (+21 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (32): abortStream(), addActionButton(), addMessage(), clearMessages(), constructor(), displayMessages(), handleDisconnect(), handleStreamComplete() (+24 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (16): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, importHelpers, inlineSourceMap, inlineSources, isolatedModules (+8 more)

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (14): apiKeys, apiSecretNames, defaultModel, defaultProvider, envVars, messageStore, lastSession, nodePath (+6 more)

### Community 18 - "Community 18"
Cohesion: 0.18
Nodes (15): buildCurrentMessage(), convertAgentMessage(), exportSession(), extractMessageText(), extractResultText(), extractTextFromMessage(), extractThinkingFromMessage(), generateMessageId() (+7 more)

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (12): AttachmentPicker, Attachment, ChatInputCallbacks, ChatMessage, generateMessageId(), RpcEvent, StreamCallbacks, ContentBlock (+4 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (4): PermissionConfirmModal, PermissionInputModal, PermissionResponse, PermissionSelectModal

### Community 22 - "Community 22"
Cohesion: 0.20
Nodes (7): SessionPanelCallbacks, ContentBlock, fsPromisesModule, osModule, pathModule, PiSession, SessionScanner

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (12): files, code, document, image, paper, video, graphifyignore_patterns, needs_graph (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (7): fetchCommands(), getCommands(), registerPiCommands(), setConnection(), trigger(), triggerCommandSuggest(), triggerFilePicker()

### Community 25 - "Community 25"
Cohesion: 0.19
Nodes (6): currentLang, escapeRegex(), LocaleModule, locales, t(), UserMessageActions

### Community 26 - "Community 26"
Cohesion: 0.16
Nodes (3): CommandSuggest, CommandSuggestModal, PiCommand

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (10): DesktopVaultAdapter, ModelOption, ModelSwitchModal, MessageStoreData, showCriticalNotice(), buildSessionEntries(), extractPreview(), formatFileDate() (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.24
Nodes (10): createProviderModelSettings(), focus(), getProviderEnvVarName(), getProviderModels(), hide(), readPiModelsConfig(), show(), startEditingSessionName() (+2 more)

### Community 34 - "Community 34"
Cohesion: 0.25
Nodes (7): author, description, id, isDesktopOnly, minAppVersion, name, version

### Community 36 - "Community 36"
Cohesion: 0.29
Nodes (7): Return Banner Position Design, Checkpoint Persistence Decision, Load vs Reload Message Distinction, Session Management System, Entry ID Sync Mechanism, Rewind Fork Semantics, Return to Latest Feature

### Community 39 - "Community 39"
Cohesion: 0.67
Nodes (3): Callbacks Pattern, Event-Driven Architecture, Plugin Entry Point Pattern

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (3): Command Integration, JSON Line Protocol, RPC Mode Communication

## Knowledge Gaps
- **621 isolated node(s):** `fs`, `os`, `path`, `{ providers, error }`, `PiModelConfig` (+616 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PiChatView` connect `Community 4` to `Community 20`, `Community 30`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `sessions` connect `Community 0` to `Community 17`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `PiStatusBar` connect `Community 31` to `Community 25`, `Community 30`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `fs`, `os`, `path` to the rest of the system?**
  _633 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.011428571428571429 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.011494252873563218 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.012121212121212121 - nodes in this community are weakly interconnected._