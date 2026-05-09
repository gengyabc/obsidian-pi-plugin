import { App, Component, MarkdownRenderer } from "obsidian";

/** Actions available on a user message (e.g., rewind) */
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

    constructor(app: App) {
        this.app = app;
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
    ): HTMLElement {
        const wrapper = container.createDiv({ cls: "pi-message pi-message-assistant" });
        const label = wrapper.createDiv({ cls: "pi-message-label" });
        label.createSpan({ text: "Pi", cls: "pi-message-label-text" });

        // Thinking block (collapsed) goes before the response text
        if (thinkingContent) {
            const thinkingEl = wrapper.createEl("details", { cls: "pi-thinking" });
            thinkingEl.createEl("summary", { text: "Thinking…" });
            const thinkingContentEl = thinkingEl.createDiv({ cls: "pi-thinking-content" });
            try {
                MarkdownRenderer.render(this.app, thinkingContent, thinkingContentEl, sourcePath, component);
            } catch (err) {
                console.error("[Pi Chat] Thinking render error:", err);
                thinkingContentEl.setText(thinkingContent);
            }
        }

        const contentEl = wrapper.createDiv({ cls: "pi-message-content" });

        if (markdown) {
            try {
                MarkdownRenderer.render(this.app, markdown, contentEl, sourcePath, component);
            } catch (err) {
                console.error("[Pi Chat] Markdown rendering error:", err);
                contentEl.setText(markdown);
            }
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

        // Add rewind action button if provided
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
            argsSection.createEl("div", { text: "Arguments", cls: "pi-tool-section-label" });
            const argsCode = argsSection.createEl("pre");
            argsCode.createEl("code", { text: args });
        }

        // Render result — use markdown rendering for rich content
        if (result) {
            const resultSection = body.createDiv({ cls: "pi-tool-result" });
            resultSection.createEl("div", { text: "Result", cls: "pi-tool-section-label" });

            const resultContent = resultSection.createDiv({ cls: "pi-tool-result-content" });

            // If result looks like it contains code or markdown, render it
            if (this.looksLikeMarkdown(result)) {
                try {
                    MarkdownRenderer.render(
                        this.app,
                        result,
                        resultContent,
                        "",
                        component,
                    );
                } catch (err) {
                    console.error("[Pi Chat] Tool result render error:", err);
                    const pre = resultContent.createEl("pre");
                    pre.createEl("code", { text: result });
                }
            } else {
                const pre = resultContent.createEl("pre");
                pre.createEl("code", { text: result });
            }
        }

        return wrapper;
    }

    /**
     * Simple heuristic to detect if content contains markdown.
     * Falls back to code block rendering for plain text.
     */
    private looksLikeMarkdown(text: string): boolean {
        return /```|^#{1,6}\s|^\s*[-*]\s|\[.*\]\(|\!\[|> |^\|.*\|/m.test(text);
    }
}
