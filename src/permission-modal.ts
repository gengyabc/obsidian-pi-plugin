/**
 * Permission modal for handling extension UI requests.
 *
 * Used by pi-permission-system and other extensions to request
 * user confirmation in RPC mode. Replaces window.prompt/confirm
 * which don't work in Electron.
 */

import { App, Modal } from "obsidian";
import { t } from "./i18n/index";

type PermissionResponse = {
    value?: string;
    confirmed?: boolean;
    cancelled?: boolean;
};

/**
 * Modal for selecting from a list of options.
 */
export class PermissionSelectModal extends Modal {
    private title: string;
    private options: string[];
    private selectedOption: string | null = null;
    private onResponse: (response: PermissionResponse) => void;

    constructor(
        app: App,
        title: string,
        options: string[],
        onResponse: (response: PermissionResponse) => void,
    ) {
        super(app);
        this.title = title;
        this.options = options;
        this.onResponse = onResponse;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass("pi-permission-modal");

        // Title
        contentEl.createEl("h2", { text: this.title });

        // Options as buttons
        const optionsContainer = contentEl.createDiv({ cls: "pi-permission-options" });
        for (const option of this.options) {
            const btn = optionsContainer.createEl("button", {
                cls: "pi-permission-option-btn",
                text: option,
                attr: { type: "button" },
            });
            btn.addEventListener("click", () => {
                this.selectedOption = option;
                this.close();
            });
            btn.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    this.selectedOption = option;
                    this.close();
                }
            });
        }

        // Cancel button
        const cancelBtn = contentEl.createEl("button", {
            cls: "pi-permission-cancel-btn",
            text: t("modals.cancel"),
            attr: { type: "button" },
        });
        cancelBtn.addEventListener("click", () => {
            this.close();
        });
        cancelBtn.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this.close();
            }
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();

        if (this.selectedOption) {
            this.onResponse({ value: this.selectedOption });
        } else {
            this.onResponse({ cancelled: true });
        }
    }
}

/**
 * Modal for yes/no confirmation.
 */
export class PermissionConfirmModal extends Modal {
    private title: string;
    private message: string;
    private confirmed: boolean = false;
    private onResponse: (response: PermissionResponse) => void;

    constructor(
        app: App,
        title: string,
        message: string,
        onResponse: (response: PermissionResponse) => void,
    ) {
        super(app);
        this.title = title;
        this.message = message;
        this.onResponse = onResponse;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass("pi-permission-modal");

        // Title
        contentEl.createEl("h2", { text: this.title });

        // Message
        if (this.message) {
            contentEl.createEl("p", { text: this.message });
        }

        // Buttons
        const buttonsContainer = contentEl.createDiv({ cls: "pi-permission-buttons" });
        const confirmBtn = buttonsContainer.createEl("button", {
            cls: "pi-permission-confirm-btn",
            text: t("modals.confirmYes"),
            attr: { type: "button" },
        });
        confirmBtn.addEventListener("click", () => {
            this.confirmed = true;
            this.close();
        });
        confirmBtn.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this.confirmed = true;
                this.close();
            }
        });

        const cancelBtn = buttonsContainer.createEl("button", {
            cls: "pi-permission-cancel-btn",
            text: t("modals.confirmNo"),
            attr: { type: "button" },
        });
        cancelBtn.addEventListener("click", () => {
            this.close();
        });
        cancelBtn.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this.close();
            }
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();

        this.onResponse({ confirmed: this.confirmed });
    }
}

/**
 * Modal for text input.
 */
export class PermissionInputModal extends Modal {
    private title: string;
    private message: string;
    private placeholder: string;
    private initialValue: string;
    private inputValue: string | null = null;
    private onResponse: (response: PermissionResponse) => void;

    constructor(
        app: App,
        title: string,
        message: string,
        placeholder: string,
        initialValue: string,
        onResponse: (response: PermissionResponse) => void,
    ) {
        super(app);
        this.title = title;
        this.message = message;
        this.placeholder = placeholder;
        this.initialValue = initialValue;
        this.onResponse = onResponse;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass("pi-permission-modal");

        // Title
        contentEl.createEl("h2", { text: this.title });

        // Message
        if (this.message) {
            contentEl.createEl("p", { text: this.message });
        }

        // Input field
        const inputEl = contentEl.createEl("input", {
            cls: "pi-permission-input",
            attr: {
                type: "text",
                placeholder: this.placeholder,
                value: this.initialValue,
                "aria-label": this.title,
            },
        });
        inputEl.addEventListener("input", () => {
            this.inputValue = inputEl.value;
        });
        inputEl.focus();

        // Buttons
        const buttonsContainer = contentEl.createDiv({ cls: "pi-permission-buttons" });
        const submitBtn = buttonsContainer.createEl("button", {
            cls: "pi-permission-confirm-btn",
            text: t("modals.submit"),
            attr: { type: "button" },
        });
        submitBtn.addEventListener("click", () => {
            this.inputValue = inputEl.value;
            this.close();
        });
        submitBtn.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this.inputValue = inputEl.value;
                this.close();
            }
        });

        const cancelBtn2 = buttonsContainer.createEl("button", {
            cls: "pi-permission-cancel-btn",
            text: t("modals.cancel"),
            attr: { type: "button" },
        });
        cancelBtn2.addEventListener("click", () => {
            this.inputValue = null;
            this.close();
        });
        cancelBtn2.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this.inputValue = null;
                this.close();
            }
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();

        if (this.inputValue !== null) {
            this.onResponse({ value: this.inputValue });
        } else {
            this.onResponse({ cancelled: true });
        }
    }
}
