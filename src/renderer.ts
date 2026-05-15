import { App, Component, MarkdownRenderer, Notice } from "obsidian";
import { t } from "./i18n/index";

/** Actions available on a user message. */
export interface UserMessageActions {
    onRewind?: () => void;
    rewindDisabled?: boolean;
    rewindTitle?: string;
}

/**
 * Renders chat messages using Obsidian's native MarkdownRenderer.
 * This gives us Mermaid diagrams, wiki-links, callouts, code highlighting, etc.
 */
export class MessageRenderer {
    private app: App;
    /** Debounce render error notices - only show once every 5 seconds */
    private lastRenderErrorTime = 0;

    constructor(app: App) {
        this.app = app;
    }

    /** Show render error notice if debounce allows */
    private showRenderError(): void {
        const now = Date.now();
        if (now - this.lastRenderErrorTime > 5000) {
            this.lastRenderErrorTime = now;
            new Notice(t("notices.renderError"));
        }
    }

    /**
     * Render an assistant message as Obsidian-flavored markdown.
     * Returns the wrapper element for use by streaming logic.
     */
    renderAssistantMessage(
        container: HTMLElement,
        markdown: string,
        sourcePath: string,
        component: Component,
        thinkingContent?: string,
        error?: string,
    ): HTMLElement {
        const wrapper = container.createDiv({ cls: "pi-message pi-message-assistant" });
        const label = wrapper.createDiv({ cls: "pi-message-label" });
        label.createSpan({ text: "Pi", cls: "pi-message-label-text" });

        // Error message (if API error occurred)
        if (error) {
            const errorEl = wrapper.createDiv({ cls: "pi-message-error" });
            errorEl.createEl("strong", { text: t("renderer.errorLabel") });
            errorEl.createSpan({ text: error });
        }

        // Thinking block (collapsed) goes before the response text
        if (thinkingContent) {
            const thinkingEl = wrapper.createEl("details", { cls: "pi-thinking" });
            thinkingEl.createEl("summary", { text: t("renderer.thinkingSummary") });
            const thinkingContentEl = thinkingEl.createDiv({ cls: "pi-thinking-content" });
            MarkdownRenderer.render(this.app, thinkingContent, thinkingContentEl, sourcePath, component).catch((err) => {
                console.error("[Pi Chat] Thinking render error:", err);
                thinkingContentEl.setText(thinkingContent);
                this.showRenderError();
            });
        }

        const contentEl = wrapper.createDiv({ cls: "pi-message-content" });

        if (markdown) {
            MarkdownRenderer.render(this.app, markdown, contentEl, sourcePath, component).catch((err) => {
                console.error("[Pi Chat] Markdown rendering error:", err);
                contentEl.setText(markdown);
                this.showRenderError();
            });
        }

        return wrapper;
    }

    /**
     * Render a user message in a styled container.
     * Optional actions parameter allows adding rewind button.
     */
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
            this.addActionButton(actionBar, {
                cls: "pi-message-rewind-btn",
                text: t("view.rewind"),
                title: actions.rewindTitle ?? t("renderer.rewindTooltip"),
                disabled: actions.rewindDisabled,
                onClick: actions.onRewind,
            });
        }

        const contentEl = wrapper.createDiv({ cls: "pi-message-content" });
        contentEl.createEl("p", { text });

        return wrapper;
    }

    /**
     * Render a tool call/result in a collapsible <details> element.
     * Shows the tool name in the summary, with args and result inside.
     */
    renderToolCall(
        container: HTMLElement,
        toolName: string,
        args: string,
        result: string,
        isError: boolean,
        component: Component,
    ): HTMLElement {
        const wrapper = container.createDiv({
            cls: `pi-message pi-message-tool${isError ? " pi-message-tool-error" : ""}`,
        });

        const details = wrapper.createEl("details");
        const summary = details.createEl("summary");
        summary.createSpan({ text: `⚙ ${toolName}`, cls: "pi-tool-name" });

        if (isError) {
            summary.createSpan({ text: " ✗", cls: "pi-tool-error-indicator" });
        }

        const body = details.createDiv({ cls: "pi-tool-body" });

        // Render args if present
        if (args) {
            const argsSection = body.createDiv({ cls: "pi-tool-args" });
            argsSection.createEl("div", { text: t("renderer.arguments"), cls: "pi-tool-section-label" });
            const argsCode = argsSection.createEl("pre");
            argsCode.createEl("code", { text: args });
        }

        // Render result — use markdown rendering for rich content
        if (result) {
            const resultSection = body.createDiv({ cls: "pi-tool-result" });
            resultSection.createEl("div", { text: t("renderer.result"), cls: "pi-tool-section-label" });

            const resultContent = resultSection.createDiv({ cls: "pi-tool-result-content" });

            // If result looks like it contains code or markdown, render it
            if (this.looksLikeMarkdown(result)) {
                MarkdownRenderer.render(
                    this.app,
                    result,
                    resultContent,
                    "",
                    component,
                ).catch((err) => {
                    console.error("[Pi Chat] Tool result render error:", err);
                    const pre = resultContent.createEl("pre");
                    pre.createEl("code", { text: result });
                    this.showRenderError();
                });
            } else {
                const pre = resultContent.createEl("pre");
                pre.createEl("code", { text: result });
            }
        }

        return wrapper;
    }

    private addActionButton(
        actionBar: HTMLElement,
        options: {
            cls: string;
            text: string;
            title: string;
            disabled?: boolean;
            onClick?: () => void;
        },
    ): HTMLButtonElement {
        const btn = actionBar.createEl("button", {
            cls: options.cls,
            attr: {
                "aria-label": options.title,
                title: options.title,
                type: "button",
            },
        });
        btn.setText(options.text);

        if (options.disabled) {
            btn.setAttribute("disabled", "true");
            btn.addClass("is-disabled");
        } else if (options.onClick) {
            btn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                options.onClick?.();
            });
        }

        return btn;
    }

    /**
     * Simple heuristic to detect if content contains markdown.
     * Falls back to code block rendering for plain text.
     */
    private looksLikeMarkdown(text: string): boolean {
        return /```|^#{1,6}\s|^\s*[-*]\s|\[.*\]\(|!\[|> |^\|.*\|/m.test(text);
    }
}
