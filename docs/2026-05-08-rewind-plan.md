
**“基于 Pi RPC fork 的 message rewind + return to latest”**


```text
用户点击某条 user message 的 undo 图标
→ Pi fork 到这条消息之前
→ 插件把这条消息文本放回输入框
→ UI 重新加载 fork 后的会话
→ 显示 Return to latest

如果用户点击 Return to latest
→ switch_session 回到 undo 前的原 session

如果用户在 rewind 后发送新消息
→ 清空 Return to latest
→ 新 fork 成为当前主线
```

关键点是：**Pi 的 fork 本身会创建新 session；因此 undo 前只要记录原 sessionFile，return 时直接 `switch_session` 回去。** RPC 文档里 `fork` 支持从历史 user message 创建 fork，`switch_session` 支持按 sessionPath 切换 session，`get_state` 会返回当前 `sessionFile`，`get_messages` 可以重新拉取当前会话消息。([皮开发][1])

---

# 1. 最难的问题与解决方案

## 难点一：这不是严格 undo，而是 fork

Pi RPC 的 `fork` 语义是：

```json
{ "type": "fork", "entryId": "abc123" }
```

它从当前 active branch 上的历史 user message 创建 fork，并返回那条原始 prompt 文本。Extension 文档进一步说明 `ctx.fork(entryId)` 会创建新的 session file，默认 `position: "before"`，也就是 fork 到所选 user message 之前，并把该 prompt 恢复到编辑器。([皮开发][1])

所以点击某条 user message 的 undo 图标后，最自然的体验应该是：

```text
回到这条用户输入之前；
把这条用户输入放回输入框；
用户可以修改后重新发送。
```

这其实很像 Cursor/OpenCode 的“回到这一步重新做”，不是传统编辑器的“撤销一个字符”。

---

## 难点二：Return to latest 怎么保证后端一致

不要只恢复前端消息快照。那样 UI 看起来回去了，但 Pi 后端 session 还在 fork 后的新状态，下一次发送消息会错。

正确方案：

```text
rewind 前：
  get_state → 记录 originalSessionPath

rewind：
  fork(targetEntryId)
  get_state → 得到 forkSessionPath
  get_messages → 重新渲染 fork session

return：
  switch_session(originalSessionPath)
  get_messages → 重新渲染 original session
```

这样 Return to latest 是真实后端 session 切换，不是假 UI 恢复。Pi RPC 文档明确有 `get_state`、`get_messages` 和 `switch_session`，因此这条路线不需要改 Pi core。([皮开发][1])

---

## 难点三：每条 UI message 如何拿到 Pi 的 `entryId`

`obsidian-pi-plugin` 的 `ChatMessage` 类型里已经有 `piEntryId?: string` 字段，但主插件里也有 TODO，说明这个字段目前还没有真正填充。([GitHub][2])

第一版不要等 `agent_end` 事件里完美拿 entryId，可以直接用官方 RPC：

```json
{ "type": "get_fork_messages" }
```

它返回：

```json
{
  "messages": [
    { "entryId": "abc123", "text": "First prompt..." },
    { "entryId": "def456", "text": "Second prompt..." }
  ]
}
```

也就是说：**每次会话加载完成、agent_end 完成、fork 完成、switch_session 完成后，都调用 `get_fork_messages`，按顺序把 entryId 绑定回 UI 里的 user messages。**([皮开发][1])

匹配策略不要只靠 text，因为附件会导致 UI 文本和 Pi prompt 不一致。第一版用：

```text
第 1 条非 steering user message → 第 1 条 fork message
第 2 条非 steering user message → 第 2 条 fork message
...
```

然后做文本校验，只作为 warning，不作为硬失败。

---

## 难点四：streaming 中不能 rewind

RPC 文档说明，agent streaming 时发送普通 prompt 需要指定 streamingBehavior，否则会报错；extension command 可以立即执行，但这是另一套机制。([皮开发][1])

第一版直接规定：

```text
streaming === true 时：
  禁用 undo 图标；
  禁用 Return to latest。
```

这样最稳定。

---


# 2. 最终产品语义

建议文案和代码里不要叫完整 redo，叫：

```text
Rewind message
Return to latest
```

具体交互：

```text
U1 → A1 → U2 → A2 → U3 → A3
```

点击 U3 旁边的 undo：

```text
界面变成：
U1 → A1 → U2 → A2

输入框填入：
U3 的原始文本

顶部显示：
Return to latest
```

如果用户点击 Return to latest：

```text
回到：
U1 → A1 → U2 → A2 → U3 → A3
```

如果用户修改输入框并发送：

```text
变成新 fork：
U1 → A1 → U2 → A2 → U3' → A3'

Return to latest 消失。
原来的 latest session 不删除，只是不再作为当前线性 redo。
```

---

# 3. 执行计划

## Phase 1：补数据模型

改 `src/message-types.ts`。

目标：

```ts
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;

  toolName?: string;
  toolCallId?: string;
  isStreaming?: boolean;
  thinkingContent?: string;
  isError?: boolean;
  isSteering?: boolean;

  /** Pi's internal entry ID, used for fork/session operations */
  piEntryId?: string;

  /** True when this UI user message can be forked/rewound */
  canRewind?: boolean;

  /** Optional debug text returned by get_fork_messages */
  piForkText?: string;
}
```

---

## Phase 2：让 renderer 支持 user message action

现在 `MessageRenderer.renderUserMessage()` 只渲染文本。它需要返回 wrapper，并允许插入按钮。当前 renderer 已经有单独的 `renderUserMessage`，这是最合适的切入点。([GitHub][4])

改 `src/renderer.ts`：

```ts
export interface UserMessageActions {
  onRewind?: () => void;
  rewindDisabled?: boolean;
  rewindTitle?: string;
}

renderUserMessage(
  container: HTMLElement,
  text: string,
  isSteering?: boolean,
  actions?: UserMessageActions,
): HTMLElement {
  const cls = isSteering
    ? "pi-message pi-message-user pi-message-steer"
    : "pi-message pi-message-user";

  const wrapper = container.createDiv({ cls });

  const label = wrapper.createDiv({ cls: "pi-message-label" });
  label.createSpan({
    text: isSteering ? "You (steer)" : "You",
    cls: "pi-message-label-text",
  });

  if (actions?.onRewind) {
    const actionBar = label.createSpan({ cls: "pi-message-actions" });

    const btn = actionBar.createEl("button", {
      cls: "pi-message-rewind-btn",
      attr: {
        "aria-label": "Rewind to this message",
        title: actions.rewindTitle ?? "Rewind to this message",
        type: "button",
      },
    });

    btn.setText("↩");

    if (actions.rewindDisabled) {
      btn.setAttribute("disabled", "true");
      btn.addClass("is-disabled");
    } else {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        actions.onRewind?.();
      });
    }
  }

  const contentEl = wrapper.createDiv({ cls: "pi-message-content" });
  contentEl.createEl("p", { text });

  return wrapper;
}
```

---

## Phase 3：增加 rewind 状态类型

在 `src/view.ts` 顶部附近增加：

```ts
interface PiStateData {
  sessionFile?: string;
  sessionId?: string;
  sessionName?: string;
  isStreaming?: boolean;
  messageCount?: number;
}

interface ForkMessage {
  entryId: string;
  text: string;
}

interface ReturnCheckpoint {
  sessionPath: string;
  sessionId?: string;
  sessionName?: string;
  createdAt: number;
  fromMessageId: string;
  fromEntryId: string;
}
```

在 `PiChatView` 类里增加字段：

```ts
private returnCheckpoint: ReturnCheckpoint | null = null;
private returnBannerEl: HTMLElement | null = null;
private rewindBusy = false;
```

---

## Phase 4：封装几个 RPC helper

在 `PiChatView` 里增加这些方法。

```ts
private async getPiState(): Promise<PiStateData | null> {
  const conn = this.plugin.connection;
  if (!conn?.isConnected()) return null;

  const response = await conn.send({ type: "get_state" });
  return (response.data as PiStateData | undefined) ?? null;
}

private async updateCurrentSessionFromPi(): Promise<void> {
  const state = await this.getPiState();
  if (!state?.sessionFile) return;

  this.currentSessionPath = state.sessionFile;
  this.plugin.messageStore.setLastSession(state.sessionFile);
  this.plugin.scheduleStoreFlush();

  this.sessionPanel?.setCurrentSession(state.sessionFile);
  await this.refreshHeader();
}

private async fetchForkMessages(): Promise<ForkMessage[]> {
  const conn = this.plugin.connection;
  if (!conn?.isConnected()) return [];

  const response = await conn.send({ type: "get_fork_messages" });
  const data = response.data as { messages?: ForkMessage[] } | undefined;

  return Array.isArray(data?.messages) ? data.messages : [];
}
```

---

## Phase 5：实现 entryId 同步

这是第一版最关键的函数。

```ts
private normalizePromptText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\bAttached:.*$/i, "")
    .replace(/\b\d+ image\(s\) attached\b/i, "")
    .trim();
}

private async syncForkEntryIds(): Promise<void> {
  if (this.readOnly) return;

  let forkMessages: ForkMessage[] = [];

  try {
    forkMessages = await this.fetchForkMessages();
  } catch (err) {
    console.warn("[Pi Chat] get_fork_messages failed:", err);
    return;
  }

  const userMessages = this.messages.filter(
    (msg) => msg.role === "user" && !msg.isSteering,
  );

  for (let i = 0; i < userMessages.length; i++) {
    const uiMsg = userMessages[i];
    const forkMsg = forkMessages[i];

    if (!forkMsg) {
      uiMsg.piEntryId = undefined;
      uiMsg.canRewind = false;
      uiMsg.piForkText = undefined;
      continue;
    }

    uiMsg.piEntryId = forkMsg.entryId;
    uiMsg.canRewind = true;
    uiMsg.piForkText = forkMsg.text;

    const uiText = this.normalizePromptText(uiMsg.content);
    const piText = this.normalizePromptText(forkMsg.text);

    if (
      uiText &&
      piText &&
      uiText !== piText &&
      !uiText.startsWith(piText) &&
      !piText.startsWith(uiText)
    ) {
      console.debug("[Pi Chat] Fork text mismatch; using order mapping", {
        index: i,
        uiText,
        piText,
      });
    }
  }

  if (this.currentSessionPath) {
    this.plugin.messageStore.setMessages(this.currentSessionPath, this.messages);
    this.plugin.scheduleStoreFlush();
  }

  this.rerenderMessages();
}
```

增加 `rerenderMessages()`：

```ts
private rerenderMessages(): void {
  this.messagesContainer.empty();

  for (const msg of this.messages) {
    this.renderMessage(msg);
  }

  this.renderReturnBanner();
  this.scrollToBottom();
}
```

注意：`syncForkEntryIds()` 会 rerender，所以不要在高频 streaming delta 中调用。只在稳定点调用。

---

## Phase 6：重写 loadMessagesFromPi，支持 replace

现有 `loadMessagesFromPi()` 是追加消息。这里需要一个可复用的 reload 方法。

```ts
private async reloadMessagesFromPi(): Promise<void> {
  const conn = this.plugin.connection;
  if (!conn?.isConnected()) return;

  try {
    const response = await conn.send({ type: "get_messages" });
    const data = response.data as
      | { messages?: Array<Record<string, unknown>> }
      | undefined;

    const rawMessages = data?.messages;

    this.messages = [];
    this.messagesContainer.empty();

    if (Array.isArray(rawMessages)) {
      for (const raw of rawMessages) {
        const msg = this.convertAgentMessage(raw);
        if (msg) this.messages.push(msg);
      }
    }

    for (const msg of this.messages) {
      this.renderMessage(msg);
    }

    if (this.currentSessionPath) {
      this.plugin.messageStore.setMessages(this.currentSessionPath, this.messages);
      this.plugin.scheduleStoreFlush();
    }

    await this.syncForkEntryIds();
    this.renderReturnBanner();
    this.scrollToBottom();
  } catch (err) {
    console.warn("[Pi Chat] get_messages failed:", err);
    new Notice("Failed to load messages from Pi");
  }
}
```

然后把原来的 `loadMessagesFromPi()` 调用点逐步替换为 `reloadMessagesFromPi()`。比如：

```ts
await this.loadMessagesFromPi();
```

改成：

```ts
await this.reloadMessagesFromPi();
```

如果想保持旧方法名，也可以让旧方法直接调用新方法：

```ts
private async loadMessagesFromPi(): Promise<void> {
  await this.reloadMessagesFromPi();
}
```

---

## Phase 7：实现 rewindToMessage

这是核心行为。

```ts
private async rewindToMessage(msg: ChatMessage): Promise<void> {
  if (this.readOnly) {
    new Notice("Cannot rewind a read-only saved session");
    return;
  }

  if (this.streaming) {
    new Notice("Wait for Pi to finish before rewinding");
    return;
  }

  if (this.rewindBusy) return;

  if (msg.role !== "user" || msg.isSteering) {
    new Notice("Only normal user messages can be rewound");
    return;
  }

  if (!msg.piEntryId) {
    new Notice("This message is not rewindable yet");
    await this.syncForkEntryIds();
    return;
  }

  const conn = this.plugin.connection;
  if (!conn?.isConnected()) {
    new Notice("Not connected to Pi");
    return;
  }

  this.rewindBusy = true;

  try {
    const before = await this.getPiState();

    if (!before?.sessionFile) {
      new Notice("Cannot determine current Pi session");
      return;
    }

    this.returnCheckpoint = {
      sessionPath: before.sessionFile,
      sessionId: before.sessionId,
      sessionName: before.sessionName,
      createdAt: Date.now(),
      fromMessageId: msg.id,
      fromEntryId: msg.piEntryId,
    };

    if (this.currentSessionPath && this.messages.length > 0) {
      this.plugin.messageStore.setMessages(this.currentSessionPath, this.messages);
      this.plugin.scheduleStoreFlush();
    }

    const response = await conn.send({
      type: "fork",
      entryId: msg.piEntryId,
    });

    const data = response.data as
      | { text?: string; cancelled?: boolean }
      | undefined;

    if (data?.cancelled) {
      this.returnCheckpoint = null;
      this.renderReturnBanner();
      new Notice("Rewind was cancelled by Pi");
      return;
    }

    await this.updateCurrentSessionFromPi();
    await this.reloadMessagesFromPi();

    const restoredText = data?.text ?? msg.piForkText ?? msg.content;

    if (this.chatInput && restoredText) {
      this.chatInput.setValue(restoredText);
      this.chatInput.focus();
    }

    this.renderReturnBanner();
    new Notice("Rewound. Edit the message or return to latest.");
  } catch (err) {
    console.error("[Pi Chat] Rewind failed:", err);
    this.returnCheckpoint = null;
    this.renderReturnBanner();

    const message = err instanceof Error ? err.message : String(err);
    new Notice(`Rewind failed: ${message}`);
  } finally {
    this.rewindBusy = false;
  }
}
```

---

## Phase 8：实现 Return to latest

```ts
private async returnToLatest(): Promise<void> {
  if (!this.returnCheckpoint) return;

  if (this.streaming) {
    new Notice("Wait for Pi to finish before returning");
    return;
  }

  if (this.rewindBusy) return;

  const checkpoint = this.returnCheckpoint;
  const conn = this.plugin.connection;

  if (!conn?.isConnected()) {
    new Notice("Not connected to Pi");
    return;
  }

  this.rewindBusy = true;

  try {
    const response = await conn.send({
      type: "switch_session",
      sessionPath: checkpoint.sessionPath,
    });

    const data = response.data as { cancelled?: boolean } | undefined;

    if (data?.cancelled) {
      new Notice("Return was cancelled by Pi");
      return;
    }

    this.returnCheckpoint = null;

    await this.updateCurrentSessionFromPi();
    await this.reloadMessagesFromPi();

    if (this.chatInput) {
      this.chatInput.setValue("");
      this.chatInput.focus();
    }

    this.renderReturnBanner();
    new Notice("Returned to latest");
  } catch (err) {
    console.error("[Pi Chat] Return to latest failed:", err);

    const message = err instanceof Error ? err.message : String(err);
    new Notice(`Return failed: ${message}`);
  } finally {
    this.rewindBusy = false;
  }
}
```

---

## Phase 9：渲染 Return banner

在 `PiChatView` 中加：

```ts
private renderReturnBanner(): void {
  if (this.returnBannerEl) {
    this.returnBannerEl.remove();
    this.returnBannerEl = null;
  }

  if (!this.returnCheckpoint) return;

  this.returnBannerEl = this.messagesContainer.createDiv({
    cls: "pi-return-banner",
  });

  const label = this.returnBannerEl.createSpan({
    cls: "pi-return-banner-text",
    text: "You are viewing a rewind fork.",
  });

  const btn = this.returnBannerEl.createEl("button", {
    cls: "pi-return-latest-btn",
    text: "Return to latest",
    attr: {
      type: "button",
      title: "Return to the session state before rewind",
    },
  });

  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    this.returnToLatest();
  });
}
```

注意：`rerenderMessages()` 里最后调用 `renderReturnBanner()`。

---

## Phase 10：renderMessage 中挂 undo 图标

把 `renderMessage(msg)` 的 user 分支改成：

```ts
private renderMessage(msg: ChatMessage): void {
  try {
    switch (msg.role) {
      case "user": {
        const canShowRewind =
          !this.readOnly &&
          !msg.isSteering &&
          !!msg.piEntryId;

        this.renderer.renderUserMessage(
          this.messagesContainer,
          msg.content,
          msg.isSteering,
          {
            onRewind: canShowRewind
              ? () => this.rewindToMessage(msg)
              : undefined,
            rewindDisabled: this.streaming || this.rewindBusy,
            rewindTitle: msg.piEntryId
              ? "Rewind to before this message"
              : "Waiting for Pi entry id",
          },
        );

        break;
      }

      case "assistant":
        this.renderer.renderAssistantMessage(
          this.messagesContainer,
          msg.content,
          "",
          this,
          msg.thinkingContent,
        );
        break;

      case "tool":
        this.renderer.renderToolCall(
          this.messagesContainer,
          msg.toolName ?? "tool",
          "",
          msg.content,
          msg.isError ?? false,
          this,
        );
        break;
    }
  } catch (err) {
    console.error("[Pi Chat] Message render error:", err);

    const errorEl = this.messagesContainer.createDiv({
      cls: "pi-message pi-render-error",
    });

    errorEl.createEl("p", { text: "⚠️ Failed to render message" });
    errorEl.createEl("pre", { text: msg.content });
  }
}
```

如果你想让“还没拿到 entryId 的 user message 也显示灰色图标”，就把 `onRewind` 始终传入，但 `rewindDisabled` 为 true。第一版建议只对 `piEntryId` 已绑定的消息显示图标，避免误导。

---

## Phase 11：在稳定点同步 entryId

在 `connectToRpc()` 的 `agent_end` 分支里加：

```ts
if ((event.type as string) === "agent_end") {
  this.refreshHeader();

  setTimeout(() => {
    this.updateCurrentSessionFromPi()
      .then(() => this.syncForkEntryIds())
      .catch((err) =>
        console.warn("[Pi Chat] Failed to sync fork ids after agent_end:", err),
      );
  }, 0);
}
```

在 `restoreSession()` 里加载完消息后加：

```ts
await this.syncForkEntryIds();
```

在 `switchToSession()` 里 `reloadMessagesFromPi()` 后加也可以，但如果 `reloadMessagesFromPi()` 内部已经调用，就不用重复。

---

## Phase 12：sendMessage 时处理“覆盖当前”

用户 rewind 后，如果发送了新消息，就清空 Return to latest。你的语义是“新分支覆盖当前线性状态”，这里直接实现：

```ts
sendMessage(text: string, attachments: Attachment[] = []): void {
  if (this.readOnly) {
    new Notice("This is a saved session (read-only). Start a new session to chat.");
    return;
  }

  const isSteering = this.streaming;

  if (!isSteering && this.returnCheckpoint) {
    this.returnCheckpoint = null;
    this.renderReturnBanner();
  }

  // 原来的 sendMessage 逻辑继续...
}
```

这样用户一旦在 fork 后发送新消息，就不会再显示 Return to latest。

---

# 4. CSS

加到 `styles.css`：

```css
.pi-message-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pi-message-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 120ms ease;
}

.pi-message-user:hover .pi-message-actions {
  opacity: 1;
}

.pi-message-rewind-btn {
  border: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
  color: var(--text-muted);
  border-radius: 6px;
  padding: 1px 6px;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}

.pi-message-rewind-btn:hover {
  color: var(--text-normal);
  background: var(--background-modifier-hover);
}

.pi-message-rewind-btn.is-disabled,
.pi-message-rewind-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pi-return-banner {
  margin: 12px auto;
  padding: 8px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  background: var(--background-secondary);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  max-width: 520px;
}

.pi-return-latest-btn {
  border: 1px solid var(--interactive-accent);
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
}
```

---

# 5. 测试计划

## 手工测试 1：普通 rewind

```text
1. 发送 U1，等待 A1。
2. 发送 U2，等待 A2。
3. 发送 U3，等待 A3。
4. 点击 U3 的 undo 图标。
```

期望：

```text
- 当前 session 切到 fork session；
- UI 显示到 U2/A2；
- 输入框填入 U3 文本；
- 出现 Return to latest；
- get_state.sessionFile 和 undo 前不同。
```

---

## 手工测试 2：Return to latest

接上一步：

```text
点击 Return to latest。
```

期望：

```text
- switch_session 回原 session；
- UI 恢复 U1/A1/U2/A2/U3/A3；
- 输入框清空；
- Return to latest 消失。
```

---

## 手工测试 3：rewind 后发送新消息

```text
1. 点击 U3 undo。
2. 修改输入框内容为 U3'。
3. 发送。
```

期望：

```text
- Return to latest 消失；
- 当前 fork session 继续生成 A3'；
- 原 latest session 不被删除，但不再作为线性 redo 显示。
```

---

## 手工测试 4：streaming 中禁止

```text
1. 发送长任务。
2. assistant streaming 时尝试点击旧 user message 的 undo。
```

期望：

```text
- 按钮 disabled，或者弹出 Notice；
- 不调用 fork；
- 当前 streaming 不受影响。
```

---

## 手工测试 5：重复文本

```text
1. 连续发送两次完全一样的 prompt。
2. 等两个回答完成。
3. 点击第二条 prompt 的 undo。
```

期望：

```text
- 按顺序映射 entryId；
- 点击第二条不会误 fork 到第一条。
```

---

# 7. 给执行模型的任务顺序

直接按这个顺序做：

```text
1. 修改 src/message-types.ts，补 canRewind / piForkText。
2. 修改 src/renderer.ts，让 renderUserMessage 支持 actions.onRewind。
3. 修改 src/view.ts：
   - 加 ReturnCheckpoint / ForkMessage / PiStateData 类型。
   - 加 returnCheckpoint / returnBannerEl / rewindBusy 字段。
   - 加 getPiState / updateCurrentSessionFromPi / fetchForkMessages。
   - 加 syncForkEntryIds。
   - 加 reloadMessagesFromPi。
   - 加 rewindToMessage。
   - 加 returnToLatest。
   - 加 renderReturnBanner。
   - 修改 renderMessage，给 user message 加 rewind 按钮。
   - 修改 sendMessage，rewind 后发送新消息时清空 returnCheckpoint。
   - 在 agent_end / restore / switch / reload 后同步 entryId。
4. 修改 styles.css，添加按钮和 Return banner 样式。
5. 运行 npm run build。
6. 按 5 个手工测试验证。
```

