import { Component, ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from "obsidian";
import type PiPlugin from "./main";
import { t } from "./i18n/index";
import { MessageRenderer } from "./renderer";
import { StreamHandler } from "./stream-handler";
import type { ChatMessage } from "./message-types";
import { generateMessageId } from "./message-types";
import { ChatInput } from "./input";
import type { Attachment } from "./input";
import { CommandSuggest } from "./commands";
import { AttachmentPicker } from "./attachments";
import { SessionManager } from "./sessions";
import { SessionPanel } from "./session-panel";
import type { PiSession } from "./session-scanner";
import { PermissionSelectModal, PermissionConfirmModal, PermissionInputModal } from "./permission-modal";
import { unlink } from "fs/promises";

// --- Rewind/Return Types ---
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

interface ExtensionUiRequest {
    type: "extension_ui_request";
    id: string;
    method: string;
    title?: string;
    message?: string;
    placeholder?: string;
    options?: string[];
    initialValue?: string;
}

export const VIEW_TYPE_PI_CHAT = "pi-chat-view";

/**
 * Obsidian ItemView that displays a chat conversation with Pi.
 * Messages are rendered as native Obsidian markdown.
 */
export class PiChatView extends ItemView {
    plugin: PiPlugin;
    private renderer: MessageRenderer;
    private streamHandler: StreamHandler;
    private sessionManager: SessionManager;
    private headerBar: HTMLElement | null = null;
    private headerSessionName: HTMLElement | null = null;
    private headerModel: HTMLElement | null = null;
    private headerCwd: HTMLElement | null = null;
    private isEditingName = false;
    private sessionPanel: SessionPanel | null = null;
    private messagesContainer: HTMLElement;
    private inputContainer: HTMLElement;
    private chatInput: ChatInput | null = null;
    private commandSuggest: CommandSuggest;
    private attachmentPicker: AttachmentPicker;
    private abortBtn: HTMLButtonElement | null = null;
    private readOnlyBanner: HTMLElement | null = null;
    private messages: ChatMessage[] = [];
    private readOnly = false;
    private streaming = false;
    /** Current Pi session file path (for message store keying) */
    private currentSessionPath: string | null = null;
    /** Return checkpoint for navigating back to original session after rewind */
    private returnCheckpoint: ReturnCheckpoint | null = null;
    /** Banner element showing "Return to latest" */
    private returnBannerEl: HTMLElement | null = null;
    /** Flag to prevent concurrent rewind operations */
    private rewindBusy = false;
    /** Chat body element (for inserting return banner above it) */
    private chatBodyEl: HTMLElement | null = null;

    /** Currently streaming assistant message element, used for live re-rendering */
    private streamingMessageEl: HTMLElement | null = null;

    /** "Thinking" indicator shown while waiting for Pi's first response */
    private thinkingIndicatorEl: HTMLElement | null = null;

    /** Component for the final markdown render after streaming completes */
    private streamingComponent: Component | null = null;

    /** Debounce timer for live markdown re-rendering during streaming */
    private streamRenderTimer: ReturnType<typeof setTimeout> | null = null;

    /** Latest streamed content waiting to be rendered */
    private pendingStreamContent: string | null = null;

    private rpcEventHandler: ((event: { type: string }) => void) | null = null;
    private activeExtensionUiOwner: "rewind" | "return" | null = null;
    private pendingRewindUiRequestIds = new Set<string>();

    constructor(leaf: WorkspaceLeaf, plugin: PiPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.renderer = new MessageRenderer(this.app);
        this.sessionManager = new SessionManager();
        this.commandSuggest = new CommandSuggest(this.app);
        this.attachmentPicker = new AttachmentPicker(this.app);
        this.streamHandler = new StreamHandler({
            onMessageUpdate: (msg) => this.handleStreamUpdate(msg),
            onMessageComplete: (msg) => this.handleStreamComplete(msg),
            onToolResult: (msg) => this.addMessage(msg),
            onCompaction: () => new Notice(t("notices.compacted")),
            onError: (err) => new Notice(t("notices.piError", { msg: err })),
        });
    }

    getViewType(): string {
        return VIEW_TYPE_PI_CHAT;
    }

    getDisplayText(): string {
        return t("view.title");
    }

    getIcon(): string {
        return "message-circle";
    }

    async onOpen(): Promise<void> {
        const container = this.contentEl;
        container.empty();
        container.addClass("pi-chat-container");

        // Header bar — session name, model, working directory
        this.headerBar = container.createDiv({ cls: "pi-header-bar" });
        this.buildHeaderBar(this.headerBar);

        // Chat body — session panel (hidden) + messages
        const chatBody = container.createDiv({ cls: "pi-chat-body" });
        this.chatBodyEl = chatBody;

        // Session panel (sidebar within chat)
        this.sessionPanel = new SessionPanel(chatBody, {
            onSwitch: (session) => this.switchToSession(session),
            onDelete: (session) => this.deleteSession(session),
            onExport: (session) => this.exportSession(session),
        });

        // Scrollable messages area
        this.messagesContainer = chatBody.createDiv({ cls: "pi-messages" });

        // Input container with ChatInput, abort button, and attachment support
        this.inputContainer = container.createDiv({ cls: "pi-input-container" });
        this.chatInput = new ChatInput(this.inputContainer, {
            onSend: (text, attachments) => this.sendMessage(text, attachments),
            onSlashTyped: () => this.triggerCommandSuggest(),
            onAtTyped: () => this.triggerFilePicker(),
        });

        // Add abort button to the input area (hidden by default)
        this.abortBtn = this.chatInput.getInputAreaEl().createEl("button", {
            cls: "pi-abort-btn",
            text: t("view.abort"),
            attr: { style: "display: none;" },
        });
        this.abortBtn.addEventListener("click", () => this.abortStream());

        this.chatInput.focus();

        // Track whether user has scrolled away from bottom
        this.messagesContainer.addEventListener("scroll", () => {
            const el = this.messagesContainer;
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            this.userScrolledUp = distFromBottom > 100;
        });

        // Wire up RPC event stream so responses are rendered
        this.connectToRpc();
    }

    async onClose(): Promise<void> {
        // Auto-save conversation before closing (skip read-only loaded sessions)
        if (!this.readOnly) {
            try {
                await this.autoSave();
            } catch (err) {
                console.error("[Pi Chat] Failed to auto-save on close:", err);
                // Continue with cleanup even if save fails
            }
        }

        // Clean up streaming state
        this.streamHandler.reset();
        this.removeThinkingIndicator();
        if (this.streamRenderTimer) {
            clearTimeout(this.streamRenderTimer);
            this.streamRenderTimer = null;
        }
        this.pendingStreamContent = null;

        // Unload any active streaming component
        if (this.streamingComponent) {
            this.streamingComponent.unload();
            this.streamingComponent = null;
        }

        // Clean up input components
        if (this.chatInput) {
            this.chatInput.destroy();
            this.chatInput = null;
        }
        this.abortBtn = null;
        this.readOnlyBanner = null;
        this.returnBannerEl = null;
        this.headerBar = null;
        this.headerSessionName = null;
        this.headerModel = null;
        this.headerCwd = null;
        if (this.sessionPanel) {
            this.sessionPanel.destroy();
            this.sessionPanel = null;
        }
        this.chatBodyEl = null;

        const conn = this.plugin.connection;
        if (conn && this.rpcEventHandler) {
            conn.offEvent(this.rpcEventHandler);
        }
        this.rpcEventHandler = null;
        this.activeExtensionUiOwner = null;
        this.pendingRewindUiRequestIds.clear();

        // Clear view state
        this.messages = [];
        this.readOnly = false;
        this.streamingMessageEl = null;
        this.contentEl.empty();
    }

    /**
     * Add a message to the chat and render it.
     */
    addMessage(msg: ChatMessage): void {
        this.messages.push(msg);
        this.renderMessage(msg);
        this.scrollToBottom();
        this.persistMessage(msg);
    }

    /**
     * Get all messages in the conversation.
     */
    getMessages(): ChatMessage[] {
        return [...this.messages];
    }

    /**
     * Get the messages container element (used by streaming logic to append live content).
     */
    getMessagesContainer(): HTMLElement {
        return this.messagesContainer;
    }

    /** Whether the user has manually scrolled away from the bottom */
    private userScrolledUp = false;

    /**
     * Scroll the messages container to the bottom unless the user has scrolled up.
     */
    scrollToBottom(): void {
        if (this.userScrolledUp) return;
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    /**
     * Wire this view to a PiConnection's event stream.
     */
    connectToRpc(): void {
        const conn = this.plugin.ensureConnection();
        if (this.rpcEventHandler) {
            conn.offEvent(this.rpcEventHandler);
        }

        this.rpcEventHandler = (event) => {
            if ((event.type as string) === "extension_ui_request") {
                this.handleExtensionUiRequest(event as unknown as ExtensionUiRequest);
                return;
            }

            this.streamHandler.handleEvent(event);
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
        };

        conn.onEvent(this.rpcEventHandler);
        this.commandSuggest.setConnection(conn);

        // Initial header refresh + restore last session after connection
        setTimeout(() => {
            this.refreshHeader();
            this.restoreSession();
        }, 1000);
    }

    /**
     * Restore the current session's messages on startup.
     * Tries the local store first (fast), falls back to get_messages RPC.
     */
    private async restoreSession(): Promise<void> {
        const conn = this.plugin.connection;
        if (!conn?.isConnected()) return;

        try {
            const response = await conn.send({ type: "get_state" });
            const data = response.data as Record<string, unknown> | undefined;
            const sessionFile = data?.sessionFile as string | undefined;
            if (sessionFile) {
                this.currentSessionPath = sessionFile;
                this.plugin.messageStore.setLastSession(sessionFile);
                this.plugin.scheduleStoreFlush();

                // If we have no messages displayed, load them
                if (this.messages.length === 0) {
                    // Try local store first (instant)
                    const stored = this.plugin.messageStore.getMessages(sessionFile);
                    if (stored.length > 0) {
                        this.displayMessages(stored, false);
                        // Sync fork entryIds after displaying stored messages
                        await this.syncForkEntryIds();
                    } else {
                        // Fall back to loading from Pi
                        await this.loadMessagesFromPi();
                        // Sync fork entryIds after loading from Pi
                        await this.syncForkEntryIds();
                    }
                }
            }
        } catch {
            // Non-fatal
        }
    }

    /**
     * Build the header bar contents: session name, model badge, cwd, new session button.
     */
    private buildHeaderBar(container: HTMLElement): void {
        const left = container.createDiv({ cls: "pi-header-left" });

        // Session name — click to edit
        this.headerSessionName = left.createSpan({
            cls: "pi-header-session-name",
            text: t("view.newSession"),
        });
        this.headerSessionName.setAttribute("title", t("view.sessionName.tooltip"));
        this.headerSessionName.addEventListener("click", () => this.startEditingSessionName());

        // Model badge
        this.headerModel = left.createSpan({
            cls: "pi-header-model",
            text: "",
        });

        // Working directory
        this.headerCwd = left.createSpan({
            cls: "pi-header-cwd",
            text: "",
        });

        const right = container.createDiv({ cls: "pi-header-right" });

        // Sessions toggle button
        const sessionsBtn = right.createEl("button", {
            cls: "pi-header-sessions-btn",
            attr: { "aria-label": t("view.sessionsBtn.tooltip") },
        });
        sessionsBtn.setText("📋");
        sessionsBtn.addEventListener("click", () => this.sessionPanel?.toggle());

        // New session button
        const newBtn = right.createEl("button", {
            cls: "pi-header-new-btn",
            attr: { "aria-label": t("view.newBtn.tooltip") },
        });
        newBtn.setText("+ New");
        newBtn.addEventListener("click", () => this.newSessionFromHeader());
    }

    /**
     * Refresh the header bar with current session state from Pi.
     */
    async refreshHeader(): Promise<void> {
        const conn = this.plugin.connection;
        if (!conn?.isConnected()) return;

        try {
            const response = await conn.send({ type: "get_state" });
            const data = response.data as Record<string, unknown> | undefined;
            if (!data) return;

            // Session name
            const sessionName = data.sessionName as string | undefined;
            const sessionFile = data.sessionFile as string | undefined;
            if (this.headerSessionName && !this.isEditingName) {
                const displayName = sessionName
                    || (sessionFile ? sessionFile.replace(/^.*\//, "").replace(/\.jsonl$/, "") : null)
                    || "New Session";
                this.headerSessionName.setText(displayName);
            }

            // Model
            const model = data.model as Record<string, unknown> | undefined;
            const modelName = model?.name as string | undefined;
            const thinkingLevel = data.thinkingLevel as string | undefined;
            if (this.headerModel) {
                let modelText = modelName || "";
                if (thinkingLevel && thinkingLevel !== "off") {
                    modelText += ` :${thinkingLevel}`;
                }
                this.headerModel.setText(modelText);
                this.headerModel.style.display = modelText ? "" : "none";
            }

            // Working directory
            const cwd = data.cwd as string | undefined;
            if (this.headerCwd) {
                // Show just the last directory component
                const shortCwd = cwd ? cwd.replace(/^.*\//, "") : "";
                this.headerCwd.setText(shortCwd ? `📁 ${shortCwd}` : "");
                this.headerCwd.style.display = shortCwd ? "" : "none";
                if (cwd) this.headerCwd.setAttribute("title", cwd);
            }
        } catch {
            // Non-fatal — header is informational
        }
    }

    /**
     * Start inline editing of the session name.
     */
    private startEditingSessionName(): void {
        if (this.isEditingName || !this.headerSessionName) return;
        this.isEditingName = true;

        const currentName = this.headerSessionName.getText();
        this.headerSessionName.empty();

        const input = this.headerSessionName.createEl("input", {
            cls: "pi-header-name-input",
            attr: { type: "text", value: currentName },
        });
        input.focus();
        input.select();

        const commit = async () => {
            const newName = input.value.trim();
            this.isEditingName = false;
            if (this.headerSessionName) {
                this.headerSessionName.empty();
                this.headerSessionName.setText(newName || currentName);
            }
            if (newName && newName !== currentName) {
                try {
                    const conn = this.plugin.ensureConnection();
                    await conn.send({ type: "set_session_name", name: newName });
                } catch (err) {
                    console.warn("[Pi Chat] Failed to rename session:", err);
                    new Notice(t("notices.renameFailed"));
                    // Revert
                    if (this.headerSessionName) {
                        this.headerSessionName.setText(currentName);
                    }
                }
            }
        };

        input.addEventListener("blur", commit);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                input.blur();
            } else if (e.key === "Escape") {
                this.isEditingName = false;
                if (this.headerSessionName) {
                    this.headerSessionName.empty();
                    this.headerSessionName.setText(currentName);
                }
            }
        });
    }

    /**
     * Load messages from Pi's session via get_messages RPC and display them.
     */
    private async loadMessagesFromPi(): Promise<void> {
        const conn = this.plugin.connection;
        if (!conn?.isConnected()) return;

        try {
            const response = await conn.send({ type: "get_messages" });
            const data = response.data as Record<string, unknown> | undefined;
            const rawMessages = data?.messages as Array<Record<string, unknown>> | undefined;
            if (!Array.isArray(rawMessages) || rawMessages.length === 0) return;

            const chatMessages: ChatMessage[] = [];
            for (const raw of rawMessages) {
                const msg = this.convertAgentMessage(raw);
                if (msg) chatMessages.push(msg);
            }

            if (chatMessages.length > 0) {
                for (const msg of chatMessages) {
                    this.messages.push(msg);
                    this.renderMessage(msg);
                }
                this.scrollToBottom();

                // Cache in store for fast reload next time
                if (this.currentSessionPath) {
                    this.plugin.messageStore.setMessages(this.currentSessionPath, this.messages);
                    this.plugin.scheduleStoreFlush();
                }
            }
        } catch (err) {
            console.warn("[Pi Chat] get_messages failed:", err);
        }
    }

    /**
     * Convert a Pi AgentMessage to our ChatMessage format.
     * AgentMessages have: { role: "user"|"assistant"|"toolResult", content, ... }
     */
    private convertAgentMessage(raw: Record<string, unknown>): ChatMessage | null {
        const role = raw.role as string;
        const timestamp = (raw.timestamp as number) || Date.now();

        if (role === "user") {
            const text = this.extractMessageText(raw.content);
            if (!text) return null;
            return {
                id: generateMessageId(),
                role: "user",
                content: text,
                timestamp,
            };
        }

        if (role === "assistant") {
            const content = raw.content;
            if (!Array.isArray(content)) return null;

            const text = content
                .filter((b: any) => b.type === "text" && b.text)
                .map((b: any) => b.text)
                .join("\n");

            const thinking = content
                .filter((b: any) => b.type === "thinking" && b.thinking)
                .map((b: any) => b.thinking)
                .join("\n\n");

            if (!text && !thinking) return null;

            return {
                id: generateMessageId(),
                role: "assistant",
                content: text,
                timestamp,
                thinkingContent: thinking || undefined,
            };
        }

        if (role === "toolResult") {
            const text = this.extractMessageText(raw.content);
            return {
                id: generateMessageId(),
                role: "tool",
                content: text,
                timestamp,
                toolName: (raw.toolName as string) || "tool",
                toolCallId: (raw.toolCallId as string) || undefined,
                isError: (raw.isError as boolean) || undefined,
            };
        }

        return null;
    }

    /**
     * Public API for starting a new session (used by command palette).
     */
    startNewSession(): void {
        this.newSessionFromHeader();
    }

    /**
     * Create a new session from the header button.
     */
    private async newSessionFromHeader(): Promise<void> {
        // Save current messages to store
        if (this.currentSessionPath && this.messages.length > 0) {
            this.plugin.messageStore.setMessages(this.currentSessionPath, this.messages);
        }

        // Save markdown snapshot if it has content
        if (this.hasMessages()) {
            try {
                await this.autoSave();
            } catch (err) {
                console.error("[Pi Chat] Auto-save before new session failed:", err);
            }
        }

        // Reset stream handler and view
        this.streamHandler.reset();
        this.setStreamingState(false);
        this.removeThinkingIndicator();
        this.clearMessages();
        this.currentSessionPath = null;

        const conn = this.plugin.connection;
        if (conn?.isConnected()) {
            try {
                const response = await conn.send({ type: "new_session" });
                const data = response.data as Record<string, unknown> | undefined;
                if (data?.cancelled) {
                    new Notice(t("notices.newSessionCancelled"));
                    return;
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error("[Pi Chat] new_session RPC failed:", err);
                new Notice(`Failed to create new session: ${msg}`);
                return;
            }
        }

        // Get the new session's path from Pi
        try {
            const conn = this.plugin.connection;
            if (conn?.isConnected()) {
                const state = await conn.send({ type: "get_state" });
                const data = state.data as Record<string, unknown> | undefined;
                const sessionFile = data?.sessionFile as string | undefined;
                if (sessionFile) {
                    this.currentSessionPath = sessionFile;
                    this.plugin.messageStore.setLastSession(sessionFile);
                    this.plugin.scheduleStoreFlush();
                }
            }
        } catch {
            // Non-fatal
        }

        // Reset header
        if (this.headerSessionName) this.headerSessionName.setText(t("view.newSession"));
        this.sessionPanel?.setCurrentSession(this.currentSessionPath);
        this.plugin.statusBar?.refreshModel();
        this.refreshHeader();
        new Notice(t("notices.newSession"));
    }

    /**
     * Switch to a Pi session by path.
     */
    private async switchToSession(session: PiSession): Promise<void> {
        // Save current messages to store before switching
        if (this.currentSessionPath && this.messages.length > 0) {
            this.plugin.messageStore.setMessages(this.currentSessionPath, this.messages);
        }

        // Save markdown snapshot if needed
        if (this.hasMessages()) {
            try {
                await this.autoSave();
            } catch (err) {
                console.error("[Pi Chat] Auto-save before switch failed:", err);
            }
        }

        // Reset stream handler before clearing view
        this.streamHandler.reset();
        this.setStreamingState(false);
        this.clearMessages();

        const conn = this.plugin.connection;
        if (!conn?.isConnected()) {
            new Notice(t("notices.notConnected"));
            return;
        }

        try {
            const response = await conn.send({ type: "switch_session", sessionPath: session.path });
            const data = response.data as Record<string, unknown> | undefined;
            if (data?.cancelled) {
                new Notice(t("notices.switchCancelled"));
                return;
            }
        } catch (err) {
            console.warn("[Pi Chat] switch_session RPC failed:", err);
            new Notice(t("notices.switchFailed"));
            return;
        }

        // Update session tracking
        this.currentSessionPath = session.path;
        this.plugin.messageStore.setLastSession(session.path);
        this.plugin.scheduleStoreFlush();

        // Load messages from Pi (source of truth)
        await this.loadMessagesFromPi();

        // Update header and panel state
        if (this.headerSessionName) {
            this.headerSessionName.setText(session.name);
        }
        this.sessionPanel?.setCurrentSession(session.path);
        this.sessionPanel?.hide();

        // Update status bar
        this.plugin.statusBar?.refreshModel();
        this.plugin.statusBar?.refreshStats();

        new Notice(t("notices.switchedTo", { name: session.name }));
        this.refreshHeader();
    }

    /**
     * Delete a Pi session file.
     */
    private async deleteSession(session: PiSession): Promise<void> {
        await unlink(session.path);
    }

    /**
     * Export a Pi session to the vault as a markdown note.
     * Reads Pi's .jsonl format (typed entries with { type: "message", message: {...} } wrappers).
     */
    private async exportSession(session: PiSession): Promise<void> {
        try {
            const { readFile } = await import("fs/promises");
            const content = await readFile(session.path, "utf-8");
            const lines = content.split("\n").filter((l) => l.trim());

            const messages: ChatMessage[] = [];
            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    // Pi wraps messages in { type: "message", message: { role, content, ... } }
                    if (entry.type !== "message" || !entry.message) continue;

                    const msg = entry.message;
                    const text = this.extractMessageText(msg.content);

                    if (msg.role === "user" && text) {
                        messages.push({
                            id: generateMessageId(),
                            role: "user",
                            content: text,
                            timestamp: msg.timestamp || Date.now(),
                        });
                    } else if (msg.role === "assistant" && text) {
                        messages.push({
                            id: generateMessageId(),
                            role: "assistant",
                            content: text,
                            timestamp: msg.timestamp || Date.now(),
                        });
                    } else if (msg.role === "toolResult") {
                        const resultText = this.extractMessageText(msg.content);
                        if (resultText) {
                            messages.push({
                                id: generateMessageId(),
                                role: "tool",
                                content: resultText,
                                toolName: msg.toolName || "tool",
                                toolCallId: msg.toolCallId,
                                isError: msg.isError || undefined,
                                timestamp: msg.timestamp || Date.now(),
                            });
                        }
                    }
                } catch {
                    // Skip malformed lines
                }
            }

            if (messages.length === 0) {
                new Notice(t("notices.noExportMessages"));
                return;
            }

            const path = await this.sessionManager.saveSession(
                messages,
                this.plugin.settings,
                this.app.vault,
            );
            if (path) {
                new Notice(t("notices.exportedTo", { path }));
            } else {
                new Notice(t("notices.exportFailed"));
            }
        } catch (err) {
            console.error("[Pi Chat] Export failed:", err);
            new Notice(t("notices.exportFailedGeneral"));
        }
    }

    /**
     * Extract plain text from a Pi message content field.
     * Content can be a string or an array of content blocks.
     */
    private extractMessageText(content: unknown): string {
        if (typeof content === "string") return content;
        if (Array.isArray(content)) {
            return content
                .filter((b: any) => b.type === "text" && b.text)
                .map((b: any) => b.text)
                .join("\n");
        }
        return "";
    }

    // --- Rewind/Return RPC Helpers ---

    /**
     * Get current Pi session state via get_state RPC.
     */
    private async getPiState(): Promise<PiStateData | null> {
        const conn = this.plugin.connection;
        if (!conn?.isConnected()) return null;

        try {
            const response = await conn.send({ type: "get_state" });
            return (response.data as PiStateData | undefined) ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Update currentSessionPath from Pi and sync to store/panel.
     */
    private async updateCurrentSessionFromPi(): Promise<void> {
        const state = await this.getPiState();
        if (!state?.sessionFile) return;

        this.currentSessionPath = state.sessionFile;
        this.plugin.messageStore.setLastSession(state.sessionFile);
        this.plugin.scheduleStoreFlush();

        this.sessionPanel?.setCurrentSession(state.sessionFile);
        await this.refreshHeader();
    }

    /**
     * Fetch forkable user messages from Pi via get_fork_messages RPC.
     */
    private async fetchForkMessages(): Promise<ForkMessage[]> {
        const conn = this.plugin.connection;
        if (!conn?.isConnected()) {
            return [];
        }

        try {
            const response = await conn.send({ type: "get_fork_messages" });
            const data = response.data as { messages?: ForkMessage[] } | undefined;
            return Array.isArray(data?.messages) ? data.messages : [];
        } catch (err) {
            console.warn("[Pi Chat] fetchForkMessages error:", err);
            return [];
        }
    }

    /**
     * Normalize prompt text for comparison (strip whitespace and attachment markers).
     */
    private normalizePromptText(text: string): string {
        return text
            .replace(/\s+/g, " ")
            .replace(/\bAttached:.*$/i, "")
            .replace(/\b\d+ image\(s\) attached\b/i, "")
            .trim();
    }

    /**
     * Sync fork entryIds from Pi to UI messages.
     * Called after agent_end, restore, switch, reload to bind rewind capability.
     */
    private async syncForkEntryIds(): Promise<void> {
        if (this.readOnly) {
            return;
        }

        const forkMessages = await this.fetchForkMessages();
        const userMessages = this.messages.filter(
            (msg) => msg.role === "user" && !msg.isSteering,
        );

        if (forkMessages.length !== userMessages.length) {
            console.warn("[Pi Chat] Fork message count mismatch", {
                userMessageCount: userMessages.length,
                forkMessageCount: forkMessages.length,
            });
        }

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

    /**
     * Re-render all messages (used after syncForkEntryIds changes canRewind flags).
     */
    private rerenderMessages(): void {
        this.messagesContainer.empty();

        for (const msg of this.messages) {
            this.renderMessage(msg);
        }

        this.renderReturnBanner();
        this.scrollToBottom();
    }

    private updateRewindButtonState(): void {
        const disabled = this.streaming || this.rewindBusy;
        const buttons = this.messagesContainer.querySelectorAll<HTMLButtonElement>(".pi-message-rewind-btn");

        buttons.forEach((button) => {
            button.disabled = disabled;
            button.classList.toggle("is-disabled", disabled);
        });
    }

    private resetRewindState(): void {
        this.returnCheckpoint = null;
        this.activeExtensionUiOwner = null;
        this.pendingRewindUiRequestIds.clear();
        this.renderReturnBanner();
    }

    private setRewindBusy(busy: boolean): void {
        if (this.rewindBusy === busy) return;
        this.rewindBusy = busy;
        this.updateRewindButtonState();
    }

    /**
     * Reload messages from Pi (clear + reload), used after rewind/return/switch.
     */
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
            new Notice(t("notices.messagesLoadFailed"));
        }
    }

    // --- Rewind/Return Core Logic ---

    /**
     * Rewind to a specific user message: fork before it and restore its text to input.
     */
    private async rewindToMessage(msg: ChatMessage): Promise<void> {
        if (this.readOnly) {
            new Notice(t("notices.cannotRewind"));
            return;
        }

        if (this.streaming) {
            new Notice(t("notices.waitRewind"));
            return;
        }

        if (this.rewindBusy) {
            return;
        }

        if (msg.role !== "user" || msg.isSteering) {
            new Notice(t("notices.onlyUserRewind"));
            return;
        }

        if (!msg.piEntryId) {
            new Notice(t("notices.notRewindable"));
            await this.syncForkEntryIds();
            return;
        }

        const conn = this.plugin.connection;
        if (!conn?.isConnected()) {
            new Notice(t("notices.notConnected"));
            return;
        }

        this.setRewindBusy(true);
        this.activeExtensionUiOwner = "rewind";
        this.pendingRewindUiRequestIds.clear();

        let forkSucceeded = false;

        try {
            const before = await this.getPiState();

            if (!before?.sessionFile) {
                new Notice(t("notices.noSession"));
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
                this.resetRewindState();
                new Notice(t("notices.rewindCancelled"));
                return;
            }

            forkSucceeded = true;

            await this.updateCurrentSessionFromPi();
            await this.reloadMessagesFromPi();

            const restoredText = data?.text ?? msg.piForkText ?? msg.content;

            if (this.chatInput && restoredText) {
                this.chatInput.setValue(restoredText);
                this.chatInput.focus();
            }

            this.renderReturnBanner();
            new Notice(t("notices.rewindSuccess"));
        } catch (err) {
            console.error("[Pi Chat] Rewind failed:", err);
            if (!forkSucceeded) {
                this.resetRewindState();
            } else {
                this.renderReturnBanner();
            }

            const message = err instanceof Error ? err.message : String(err);
            new Notice(`Rewind failed: ${message}`);
        } finally {
            this.activeExtensionUiOwner = null;
            this.pendingRewindUiRequestIds.clear();
            this.setRewindBusy(false);
        }
    }

    /**
     * Return to the original session before rewind.
     */
    private async returnToLatest(): Promise<void> {
        if (!this.returnCheckpoint) return;

        if (this.streaming) {
            new Notice(t("notices.waitReturn"));
            return;
        }

        if (this.rewindBusy) return;

        const checkpoint = this.returnCheckpoint;
        const conn = this.plugin.connection;

        if (!conn?.isConnected()) {
            new Notice(t("notices.notConnected"));
            return;
        }

        this.setRewindBusy(true);
        this.activeExtensionUiOwner = "return";

        try {
            const response = await conn.send({
                type: "switch_session",
                sessionPath: checkpoint.sessionPath,
            });

            const data = response.data as { cancelled?: boolean } | undefined;

            if (data?.cancelled) {
                new Notice(t("notices.returnCancelled"));
                return;
            }

            this.resetRewindState();

            await this.updateCurrentSessionFromPi();
            await this.reloadMessagesFromPi();

            if (this.chatInput) {
                this.chatInput.setValue("");
                this.chatInput.focus();
            }

            this.renderReturnBanner();
            new Notice(t("notices.returnSuccess"));
        } catch (err) {
            console.error("[Pi Chat] Return to latest failed:", err);

            const message = err instanceof Error ? err.message : String(err);
            new Notice(`Return failed: ${message}`);
        } finally {
            this.activeExtensionUiOwner = null;
            this.setRewindBusy(false);
        }
    }

    /**
     * Handle extension UI requests that block RPC commands like fork().
     */
    private handleExtensionUiRequest(event: ExtensionUiRequest): void {
        if (this.activeExtensionUiOwner === "rewind" && event.title === "Restore Options") {
            this.pendingRewindUiRequestIds.add(event.id);
        }

        switch (event.method) {
            case "select":
                this.respondToExtensionSelect(event);
                break;
            case "confirm":
                this.respondToExtensionConfirm(event);
                break;
            case "input":
            case "editor":
                this.respondToExtensionInput(event);
                break;
        }
    }

    private respondToExtensionSelect(event: ExtensionUiRequest): void {
        const options = Array.isArray(event.options) ? event.options : [];
        if (options.length === 0) {
            this.cancelRewindAfterExtensionUi(event.id);
            return;
        }

        // Auto-respond for rewind restore options
        const conversationOnly = options.find((option) =>
            /^Conversation only\b/i.test(option),
        );
        if (event.title === "Restore Options" && conversationOnly) {
            this.sendExtensionUiResponse(event.id, { value: conversationOnly });
            return;
        }

        // Use Obsidian Modal instead of window.prompt
        new PermissionSelectModal(
            this.app,
            event.title || "Choose an option",
            options,
            (response) => {
                if (response.cancelled) {
                    this.cancelRewindAfterExtensionUi(event.id);
                } else {
                    this.sendExtensionUiResponse(event.id, { value: response.value });
                }
            },
        ).open();
    }

    private respondToExtensionConfirm(event: ExtensionUiRequest): void {
        // Use Obsidian Modal instead of window.confirm
        new PermissionConfirmModal(
            this.app,
            event.title || "Confirm",
            event.message || "",
            (response) => {
                this.sendExtensionUiResponse(event.id, { confirmed: response.confirmed ?? false });
            },
        ).open();
    }

    private respondToExtensionInput(event: ExtensionUiRequest): void {
        // Use Obsidian Modal instead of window.prompt
        new PermissionInputModal(
            this.app,
            event.title || "Input",
            event.message || "",
            event.placeholder || "",
            event.initialValue ?? "",
            (response) => {
                if (response.cancelled) {
                    this.cancelRewindAfterExtensionUi(event.id);
                } else {
                    this.sendExtensionUiResponse(event.id, { value: response.value ?? "" });
                }
            },
        ).open();
    }

    private cancelRewindAfterExtensionUi(requestId: string): void {
        this.sendExtensionUiResponse(requestId, { cancelled: true });

        if (this.pendingRewindUiRequestIds.has(requestId)) {
            this.pendingRewindUiRequestIds.delete(requestId);
            this.resetRewindState();
        }
    }

    private sendExtensionUiResponse(id: string, payload: Record<string, unknown>): void {
        const conn = this.plugin.connection;
        if (!conn?.isConnected()) return;

        try {
            conn.sendRaw({ type: "extension_ui_response", id, ...payload });
        } catch (err) {
            console.warn("[Pi Chat] Failed to answer extension UI request:", err);
        }
    }

    /**
     * Render the "Return to latest" banner above the messages area.
     */
    private renderReturnBanner(): void {
        if (this.returnBannerEl) {
            this.returnBannerEl.remove();
            this.returnBannerEl = null;
        }

        if (!this.returnCheckpoint) return;

        this.returnBannerEl = this.contentEl.createDiv({
            cls: "pi-return-banner",
        });

        // Insert before chatBodyEl (headerBar is first, then banner, then chatBody)
        if (this.chatBodyEl) {
            this.contentEl.insertBefore(this.returnBannerEl, this.chatBodyEl);
        }

        const label = this.returnBannerEl.createSpan({
            cls: "pi-return-banner-text",
            text: t("view.returnBanner.text"),
        });

        const btn = this.returnBannerEl.createEl("button", {
            cls: "pi-return-latest-btn",
            text: t("view.returnBanner.button"),
            attr: {
                type: "button",
                title: t("view.returnBanner.tooltip"),
            },
        });

        btn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.returnToLatest();
        });
    }

    /**
     * Send a user message to Pi, with optional attachments and images.
     */
    sendMessage(text: string, attachments: Attachment[] = []): void {
        if (this.readOnly) {
            new Notice(t("notices.readOnly"));
            return;
        }

        // User sent a message — follow the response
        this.userScrolledUp = false;

        const isSteering = this.streaming;
        const shouldClearReturnCheckpoint = !isSteering && this.returnCheckpoint !== null;

        // Build the display text (include attachment names)
        let displayText = text;
        const fileAttachments = attachments.filter((a) => a.type === "file");
        if (fileAttachments.length > 0) {
            const names = fileAttachments.map((a) => a.name).join(", ");
            displayText += `\n\n📎 ${t("attachment.attached", { names })}`;
        }
        const imageAttachments = attachments.filter((a) => a.type === "image");
        if (imageAttachments.length > 0) {
            displayText += `\n\n🖼 ${t("attachment.imagesAttached", { count: imageAttachments.length })}`;
        }

        const userMsg: ChatMessage = {
            id: generateMessageId(),
            role: "user",
            content: displayText,
            timestamp: Date.now(),
            isSteering: isSteering || undefined,
        };
        this.addMessage(userMsg);

        if (!isSteering) {
            this.setStreamingState(true);
        }

        // Build the RPC message
        let message = text;

        // Append file content as context (XML tags avoid triple-backtick escaping issues)
        for (const att of fileAttachments) {
            message += `\n\n<file path="${att.name}">\n${att.content}\n</file>`;
        }

        const conn = this.plugin.ensureConnection();

        // During streaming: steer the agent. Otherwise: new prompt.
        const command: Record<string, unknown> = {
            type: isSteering ? "steer" : "prompt",
            message,
        };

        if (imageAttachments.length > 0) {
            command.images = imageAttachments.map((img) => ({
                type: "image",
                data: img.content,
                mimeType: img.mimeType || "image/png",
            }));
        }

        try {
            conn.send(command)
                .then(() => {
                    if (shouldClearReturnCheckpoint) {
                        this.resetRewindState();
                    }
                })
                .catch((err) => {
                    console.error("[Pi Chat] Failed to send message:", err);
                    new Notice(t("notices.sendFailed"));
                    this.removeThinkingIndicator();
                    if (!isSteering) {
                        this.setStreamingState(false);
                    }
                });

            // Show thinking indicator while waiting for Pi's response
            if (!isSteering) {
                this.showThinkingIndicator();
            }
        } catch (err) {
            console.error("[Pi Chat] Failed to send message:", err);
            new Notice(t("notices.sendFailed"));
            this.removeThinkingIndicator();
            if (!isSteering) {
                this.setStreamingState(false);
            }
        }
    }

    /**
     * Persist a message to the message store (debounced flush).
     */
    private persistMessage(msg: ChatMessage): void {
        if (this.readOnly || !this.currentSessionPath) return;
        this.plugin.messageStore.appendMessage(this.currentSessionPath, msg);
        this.plugin.scheduleStoreFlush();
    }

    /**
     * Check if the conversation has any messages worth saving.
     */
    hasMessages(): boolean {
        return this.messages.some((m) => m.role === "assistant");
    }

    /**
     * Auto-save the current conversation if it has content.
     */
    async autoSave(): Promise<string | null> {
        if (!this.hasMessages()) return null;
        try {
            const path = await this.sessionManager.saveSession(
                this.messages,
                this.plugin.settings,
                this.app.vault,
            );
            if (path) {
            }
            return path;
        } catch (err) {
            console.error("[Pi Chat] Failed to auto-save session:", err);
            return null;
        }
    }

    /**
     * Clear all messages and reset the view for a new conversation.
     */
    clearMessages(): void {
        this.messages = [];
        this.readOnly = false;
        this.streamHandler.reset();
        this.resetRewindState();
        this.removeThinkingIndicator();

        if (this.streamingComponent) {
            this.streamingComponent.unload();
            this.streamingComponent = null;
        }
        this.streamingMessageEl = null;

        // Clear DOM
        this.messagesContainer.empty();

        // Remove read-only banner if present
        if (this.readOnlyBanner) {
            this.readOnlyBanner.remove();
            this.readOnlyBanner = null;
        }

        // Re-enable input
        this.setReadOnly(false);
    }

    /**
     * Reset view state after an RPC disconnect during streaming.
     * Re-enables input, clears streaming state, and annotates any
     * partial assistant message with a connection-lost marker.
     */
    handleDisconnect(): void {
        this.streamHandler.reset();
        this.setStreamingState(false);
        this.removeThinkingIndicator();

        // Clean up any active streaming component
        if (this.streamingComponent) {
            this.streamingComponent.unload();
            this.streamingComponent = null;
        }

        if (this.streamingMessageEl) {
            const contentEl = this.streamingMessageEl.querySelector(".pi-message-content");
            if (contentEl) {
                const existing = (contentEl as HTMLElement).getText();
                (contentEl as HTMLElement).setText(existing + "\n\n*[Connection lost]*");
            }
            this.streamingMessageEl = null;
        }

        // Clear any pending stream content and timers
        if (this.streamRenderTimer) {
            clearTimeout(this.streamRenderTimer);
            this.streamRenderTimer = null;
        }
        this.pendingStreamContent = null;
    }

    /**
     * Display a list of messages (e.g. from a loaded session).
     * Optionally marks the view as read-only.
     */
    displayMessages(messages: ChatMessage[], readOnly = false): void {
        this.clearMessages();
        this.messages = [...messages];
        this.readOnly = readOnly;

        for (const msg of messages) {
            this.renderMessage(msg);
        }

        if (readOnly) {
            this.setReadOnly(true);
        }

        this.scrollToBottom();
    }

    /**
     * Set read-only mode — disables input and shows a banner.
     */
    private setReadOnly(readOnly: boolean): void {
        this.readOnly = readOnly;

        if (this.chatInput) {
            this.chatInput.setEnabled(!readOnly);
        }

        if (readOnly) {
            if (!this.readOnlyBanner) {
                this.readOnlyBanner = this.contentEl.createDiv({
                    cls: "pi-readonly-banner",
                });
                // Insert before the input container
                this.contentEl.insertBefore(this.readOnlyBanner, this.inputContainer);
                this.readOnlyBanner.setText(t("view.readOnlyBanner"));
            }
        } else {
            if (this.readOnlyBanner) {
                this.readOnlyBanner.remove();
                this.readOnlyBanner = null;
            }
        }
    }

    /**
     * Show "thinking" indicator while waiting for Pi to start responding.
     */
    private showThinkingIndicator(): void {
        // Don't show if already exists or view is cleared
        if (this.thinkingIndicatorEl || this.messages.length === 0) return;

        this.thinkingIndicatorEl = this.messagesContainer.createDiv({
            cls: "pi-thinking-indicator",
        });

        const label = this.thinkingIndicatorEl.createDiv({ cls: "pi-message-label" });
        label.createSpan({ text: "Pi", cls: "pi-message-label-text" });

        const content = this.thinkingIndicatorEl.createDiv({ cls: "pi-thinking-indicator-content" });
        content.createSpan({ cls: "pi-thinking-dots" });
        content.createSpan({ text: t("view.thinking"), cls: "pi-thinking-text" });

        this.scrollToBottom();
    }

    /**
     * Remove the thinking indicator (called when Pi starts responding or on error).
     */
    private removeThinkingIndicator(): void {
        if (this.thinkingIndicatorEl) {
            this.thinkingIndicatorEl.remove();
            this.thinkingIndicatorEl = null;
        }
    }

    /**
     * Toggle streaming state — shows/hides abort button, updates placeholder.
     * Input stays enabled so the user can send steering messages.
     */
    private setStreamingState(streaming: boolean): void {
        this.streaming = streaming;
        if (this.abortBtn) {
            this.abortBtn.style.display = streaming ? "inline-block" : "none";
        }
        if (this.chatInput) {
            this.chatInput.setPlaceholder(
                streaming
                    ? "Send a message to steer Pi…"
                    : "Message Pi… (/ for commands, @ for files)",
            );
        }
        this.updateRewindButtonState();
    }

    /**
     * Abort the current stream by sending abort command to Pi.
     */
    private abortStream(): void {
        try {
            const conn = this.plugin.ensureConnection();
            conn.send({ type: "abort" });
        } catch (err) {
            console.warn("[Pi Chat] Failed to send abort:", err);
            new Notice(t("notices.abortConnectionLost"));
        } finally {
            // Always reset streaming state so user can recover
            this.setStreamingState(false);
        }
    }

    /**
     * Trigger the `/` command suggest modal.
     */
    private triggerCommandSuggest(): void {
        // Wire up the connection for fetching commands
        try {
            const conn = this.plugin.ensureConnection();
            this.commandSuggest.setConnection(conn);
        } catch {
            // Connection may not be available yet — command suggest will return empty
        }

        this.commandSuggest.trigger((commandText) => {
            if (this.chatInput) {
                this.chatInput.setValue(commandText);
                this.chatInput.focus();
            }
        });
    }

    /**
     * Trigger the `@` file picker modal.
     */
    private triggerFilePicker(): void {
        this.attachmentPicker.trigger((attachment) => {
            if (this.chatInput) {
                // Remove the `@` character that triggered this
                const current = this.chatInput.getValue();
                if (current.endsWith("@")) {
                    this.chatInput.setValue(current.slice(0, -1));
                }
                this.chatInput.addAttachment(attachment);
                this.chatInput.focus();
            }
        });
    }

    /**
     * Handle streaming text update — debounced live markdown rendering.
     */
    private handleStreamUpdate(msg: ChatMessage): void {
        // Remove thinking indicator when Pi starts responding
        this.removeThinkingIndicator();

        if (!this.streamingMessageEl) {
            // First delta — create the assistant message container
            this.streamingMessageEl = this.messagesContainer.createDiv({
                cls: "pi-message pi-message-assistant",
            });
            const label = this.streamingMessageEl.createDiv({ cls: "pi-message-label" });
            label.createSpan({ text: "Pi", cls: "pi-message-label-text" });
            this.streamingMessageEl.createDiv({ cls: "pi-message-content" });
        }

        const contentEl = this.streamingMessageEl.querySelector(".pi-message-content");
        if (!contentEl) return;

        if (msg.content) {
            // Text is streaming — collapse live thinking block
            const liveThinking = this.streamingMessageEl.querySelector(".pi-thinking-live");
            if (liveThinking) {
                (liveThinking as HTMLDetailsElement).open = false;
                liveThinking.removeClass("pi-thinking-live");
            }

            // Schedule debounced markdown re-render
            this.pendingStreamContent = msg.content;
            if (!this.streamRenderTimer) {
                this.streamRenderTimer = setTimeout(() => {
                    this.streamRenderTimer = null;
                    this.renderStreamingMarkdown();
                }, 100);
            }
        } else if (msg.thinkingContent) {
            // Thinking in progress — show expandable live thinking block
            let thinkingEl = this.streamingMessageEl.querySelector(".pi-thinking-live") as HTMLDetailsElement | null;
            if (!thinkingEl) {
                thinkingEl = createEl("details", { cls: "pi-thinking pi-thinking-live" });
                thinkingEl.open = true;
                thinkingEl.createEl("summary", { text: t("view.thinking") });
                thinkingEl.createDiv({ cls: "pi-thinking-content" });
                this.streamingMessageEl.insertBefore(thinkingEl, contentEl);
            }
            const thinkingContentEl = thinkingEl.querySelector(".pi-thinking-content");
            if (thinkingContentEl) {
                (thinkingContentEl as HTMLElement).setText(msg.thinkingContent);
            }
        }

        this.scrollToBottom();
    }

    /**
     * Render the latest streamed content as markdown.
     * Called on a debounce timer to avoid thrashing on every delta.
     */
    private renderStreamingMarkdown(): void {
        if (!this.streamingMessageEl || !this.pendingStreamContent) return;

        const contentEl = this.streamingMessageEl.querySelector(".pi-message-content");
        if (!contentEl) return;

        // Reuse or create a component for streaming renders
        if (this.streamingComponent) {
            this.streamingComponent.unload();
        }
        this.streamingComponent = new Component();
        this.streamingComponent.load();

        // Neutralize mermaid/dataview/etc. fences during streaming —
        // they break when re-rendered on partial content.
        // The final render in handleStreamComplete uses the real content.
        const safeContent = this.pendingStreamContent.replace(
            /```(mermaid|dataview|dataviewjs|query)/g,
            "```$1-preview",
        );

        contentEl.empty();
        try {
            MarkdownRenderer.render(
                this.app,
                safeContent,
                contentEl as HTMLElement,
                "",
                this.streamingComponent,
            );
        } catch (err) {
            console.error("[Pi Chat] Streaming markdown render error:", err);
            (contentEl as HTMLElement).setText(this.pendingStreamContent);
        }

        this.scrollToBottom();
    }

    /**
     * Handle stream completion — do full markdown render and finalize the message.
     */
    private handleStreamComplete(msg: ChatMessage): void {
        // Re-enable input
        this.setStreamingState(false);
        if (this.chatInput) {
            this.chatInput.focus();
        }

        // Cancel any pending debounced render
        if (this.streamRenderTimer) {
            clearTimeout(this.streamRenderTimer);
            this.streamRenderTimer = null;
        }
        this.pendingStreamContent = null;

        // If we were streaming, do a final markdown render
        if (this.streamingMessageEl) {
            // Clean up any previous streaming component
            if (this.streamingComponent) {
                this.streamingComponent.unload();
                this.streamingComponent = null;
            }

            const contentEl = this.streamingMessageEl.querySelector(".pi-message-content");
            if (contentEl) {
                contentEl.empty();
                if (msg.content) {
                    this.streamingComponent = new Component();
                    this.streamingComponent.load();
                    try {
                        MarkdownRenderer.render(
                            this.app,
                            msg.content,
                            contentEl as HTMLElement,
                            "",
                            this.streamingComponent,
                        );
                    } catch (err) {
                        console.error("[Pi Chat] Markdown rendering error:", err);
                        (contentEl as HTMLElement).setText(msg.content);
                    }
                }
            }

            // Remove live thinking block — replaced by final rendered version
            const liveThinking = this.streamingMessageEl.querySelector(".pi-thinking-live, .pi-thinking");
            if (liveThinking) liveThinking.remove();

            // Add thinking content as a collapsed details element BEFORE the response text
            if (msg.thinkingContent) {
                // Ensure we have a component for rendering (may not exist if no main content)
                if (!this.streamingComponent) {
                    this.streamingComponent = new Component();
                    this.streamingComponent.load();
                }
                const thinkingEl = createEl("details", { cls: "pi-thinking" });
                thinkingEl.createEl("summary", { text: t("renderer.thinkingSummary") });
                const thinkingContentEl = thinkingEl.createDiv({ cls: "pi-thinking-content" });
                try {
                    MarkdownRenderer.render(
                        this.app,
                        msg.thinkingContent,
                        thinkingContentEl,
                        "",
                        this.streamingComponent,
                    );
                } catch (err) {
                    console.error("[Pi Chat] Thinking render error:", err);
                    thinkingContentEl.setText(msg.thinkingContent);
                }
                // Insert before the content div so thinking appears above the response
                this.streamingMessageEl.insertBefore(thinkingEl, contentEl);
            }

            this.streamingMessageEl = null;
        }

        // Always push message, even if the streaming element was cleaned up
        this.messages.push(msg);
        this.scrollToBottom();
        this.persistMessage(msg);
    }

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
                                ? t("renderer.rewindTooltip")
                                : t("notices.notRewindable"),
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
            const errorEl = this.messagesContainer.createDiv({ cls: "pi-message pi-render-error" });
            errorEl.createEl("p", { text: t("notices.renderError") });
            errorEl.createEl("pre", { text: msg.content });
        }
    }
}

