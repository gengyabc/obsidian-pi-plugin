/**
 * Session panel — collapsible sidebar within the chat view.
 *
 * Shows a list of Pi's native sessions (from ~/.pi/agent/sessions/),
 * with actions to switch, delete, and export. Search/filter supported.
 */

import { App, Modal, Notice, Setting } from "obsidian";
import { SessionScanner } from "./session-scanner";
import type { PiSession } from "./session-scanner";
import { t } from "./i18n/index";
import { EMPTY_PREVIEW } from "./session-list";

export interface SessionPanelCallbacks {
    /** Switch to the selected session */
    onSwitch: (session: PiSession) => Promise<void>;
    /** Delete a session */
    onDelete: (session: PiSession) => Promise<void>;
    /** Export session to vault as markdown */
    onExport: (session: PiSession) => Promise<void>;
}

export class SessionPanel {
    private containerEl: HTMLElement;
    private listEl: HTMLElement;
    private searchEl: HTMLInputElement;
    private scanner: SessionScanner;
    private callbacks: SessionPanelCallbacks;
    private app: App;
    private sessions: PiSession[] = [];
    private visible = false;
    private currentSessionPath: string | null = null;

    constructor(
        parentEl: HTMLElement,
        callbacks: SessionPanelCallbacks,
        app: App,
        sessionsDir?: string,
    ) {
        this.callbacks = callbacks;
        this.app = app;
        this.scanner = new SessionScanner(sessionsDir);

        // Panel container — hidden by default
        this.containerEl = parentEl.createDiv({ cls: "pi-session-panel is-hidden" });

        // Panel header
        const header = this.containerEl.createDiv({ cls: "pi-session-panel-header" });
        header.createSpan({ text: t("sessionPanel.title"), cls: "pi-session-panel-title" });

        const closeBtn = header.createEl("button", {
            cls: "pi-session-panel-close",
            attr: { "aria-label": t("sessionPanel.close.tooltip") },
        });
        closeBtn.setText("×");
        closeBtn.addEventListener("click", () => this.hide());
        closeBtn.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this.hide();
            }
        });

        // Search input
        this.searchEl = this.containerEl.createEl("input", {
            cls: "pi-session-panel-search",
            attr: { type: "text", placeholder: t("sessionPanel.filterPlaceholder"), "aria-label": t("sessionPanel.filterPlaceholder") },
        });
        this.searchEl.addEventListener("input", () => this.renderList());

        // Session list
        this.listEl = this.containerEl.createDiv({ cls: "pi-session-panel-list" });
    }

    /**
     * Toggle panel visibility.
     */
    toggle(): void {
        if (this.visible) {
            this.hide();
        } else {
            void this.show();
        }
    }

    /**
     * Show the panel and refresh session list.
     */
    async show(): Promise<void> {
        this.visible = true;
        this.containerEl.removeClass("is-hidden");
        await this.refresh();
        this.searchEl.focus();
    }

    /**
     * Hide the panel.
     */
    hide(): void {
        this.visible = false;
        this.containerEl.addClass("is-hidden");
    }

    /**
     * Check if the panel is visible.
     */
    isVisible(): boolean {
        return this.visible;
    }

    /**
     * Set the current active session path (highlights it in the list).
     */
    setCurrentSession(path: string | null): void {
        this.currentSessionPath = path;
        if (this.visible) {
            this.renderList();
        }
    }

    /**
     * Refresh the session list from disk.
     */
    async refresh(): Promise<void> {
        try {
            this.sessions = await this.scanner.scan();
            this.renderList();
        } catch (err) {
            console.error("[SessionPanel] Failed to scan sessions:", err);
            this.listEl.empty();
            this.listEl.createDiv({
                cls: "pi-session-panel-empty",
                text: t("sessionPanel.failedLoad"),
            });
        }
    }

    /**
     * Clean up the panel.
     */
    destroy(): void {
        this.containerEl.remove();
    }

    // --- Private ---

    private renderList(): void {
        this.listEl.empty();

        const filter = this.searchEl.value.trim().toLowerCase();
        const filtered = filter
            ? this.sessions.filter(
                (s) =>
                    s.name.toLowerCase().includes(filter) ||
                    s.preview.toLowerCase().includes(filter) ||
                    s.cwd.toLowerCase().includes(filter),
            )
            : this.sessions;

        if (filtered.length === 0) {
            this.listEl.createDiv({
                cls: "pi-session-panel-empty",
                text: this.sessions.length === 0
                    ? t("sessionPanel.empty")
                    : t("sessionPanel.noMatch"),
            });
            return;
        }

        for (const session of filtered) {
            this.renderSessionEntry(session);
        }
    }

    private renderSessionEntry(session: PiSession): void {
        const isCurrent = this.currentSessionPath === session.path;
        const entry = this.listEl.createDiv({
            cls: `pi-session-entry${isCurrent ? " pi-session-entry-active" : ""}`,
        });

        // Main content area — clickable to switch
        const content = entry.createDiv({ cls: "pi-session-entry-content", attr: { tabindex: "0" } });
        content.addEventListener("click", () => { void this.callbacks.onSwitch(session); });
        content.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void this.callbacks.onSwitch(session);
            }
        });

        // Name
        content.createDiv({
            cls: "pi-session-entry-name",
            text: session.name,
        });

        // Metadata line: date, message count, cwd
        const meta = content.createDiv({ cls: "pi-session-entry-meta" });
        meta.createSpan({ text: this.formatDate(session.mtime) });
        meta.createSpan({ text: ` · ${t("sessionPanel.msgCount", { count: session.messageCount })}` });
        if (session.cwd) {
            meta.createSpan({
                text: ` · ${session.cwd}`,
                cls: "pi-session-entry-cwd",
            });
        }

        // Preview
        if (session.preview && session.preview !== EMPTY_PREVIEW) {
            content.createDiv({
                cls: "pi-session-entry-preview",
                text: session.preview,
            });
        }

        // Action buttons
        const actions = entry.createDiv({ cls: "pi-session-entry-actions" });

        const exportBtn = actions.createEl("button", {
            cls: "pi-session-action-btn",
            attr: { "aria-label": t("sessionPanel.export.tooltip"), title: t("sessionPanel.export.tooltip") },
        });
        exportBtn.setText("📄");
        exportBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            void this.callbacks.onExport(session);
        });

        const deleteBtn = actions.createEl("button", {
            cls: "pi-session-action-btn pi-session-action-delete",
            attr: { "aria-label": t("sessionPanel.delete.tooltip"), title: t("sessionPanel.delete.tooltip") },
        });
        deleteBtn.setText("🗑");
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            void this.confirmDelete(session);
        });
    }

    private async confirmDelete(session: PiSession): Promise<void> {
        const confirmed = await new Promise<boolean>((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText(t("sessionPanel.confirmDelete", { name: session.name }));
            const content = modal.contentEl.createDiv();
            content.createEl("p", { text: t("sessionPanel.confirmDeleteDesc", { name: session.name }) ?? "Are you sure you want to delete this session?" });
            new Setting(content)
                .addButton((btn) =>
                    btn
                        .setButtonText("Cancel")
                        .onClick(() => { modal.close(); resolve(false); })
                )
                .addButton((btn) =>
                    btn
                        .setButtonText("Delete")
                        .setCta()
                        .onClick(() => { modal.close(); resolve(true); })
                );
            modal.open();
        });

        if (!confirmed) return;

        try {
            await this.callbacks.onDelete(session);
            // Remove from local list and re-render
            this.sessions = this.sessions.filter((s) => s.path !== session.path);
            this.renderList();
            new Notice(t("notices.deletedSession", { name: session.name }));
        } catch (err) {
            console.error("[SessionPanel] Delete failed:", err);
            new Notice(t("notices.deleteFailed"));
        }
    }

    private formatDate(mtime: number): string {
        const d = new Date(mtime);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = d.toDateString() === yesterday.toDateString();

        const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

        if (isToday) return t("sessionPanel.today", { time });
        if (isYesterday) return t("sessionPanel.yesterday", { time });

        return d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        }) + ` ${time}`;
    }
}
