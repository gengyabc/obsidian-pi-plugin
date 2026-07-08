import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import { Platform } from "obsidian";
import type PiPlugin from "./main";
import { t } from "./i18n/index";

import { readPiModelsConfig, getProviderEnvVarName, getProviderModels, ProviderInfo } from "./pi-config-reader";
import { normalizeThinkingLevel } from "./thinking-level";

export interface PiPluginSettings {
    piBinaryPath: string;
    nodePath: string;
    envVars: string;
    workingDirectory: string;
    defaultProvider: string;
    defaultModel: string;
    sessionSaveDir: string;
    persistSessions: boolean;
    thinkingLevel: string;
    rpcTimeout: number;
}

export const DEFAULT_SETTINGS: PiPluginSettings = {
    piBinaryPath: "pi",
    nodePath: "",
    envVars: "",
    workingDirectory: "",
    defaultProvider: "",
    defaultModel: "",
    sessionSaveDir: "Pi-Sessions",
    persistSessions: true,
    thinkingLevel: "medium",
    rpcTimeout: 60_000,
};

/**
 * Narrow control descriptors used by getSettingDefinitions(). Each shape maps
 * to a single Obsidian Setting component and a single PiPluginSettings key.
 */
type TextControl = { type: "text"; key: keyof PiPluginSettings; placeholder?: string };
type ToggleControl = { type: "toggle"; key: keyof PiPluginSettings };
type DropdownControl = { type: "dropdown"; key: keyof PiPluginSettings; options: Record<string, string> };
type SettingControl = TextControl | ToggleControl | DropdownControl;

/**
 * One row in the settings UI. Either a declarative control, a custom render
 * callback (for sliders / provider-aware dropdowns), or a plain instruction
 * paragraph (`searchable: false` so Obsidian's settings search skips it).
 */
type SettingItem =
    | { name: string; desc?: string; control: SettingControl }
    | { name?: string; desc?: string; render: (setting: Setting) => void }
    | { desc: string; searchable: false };

type SettingGroupDefinition = { type: "group"; heading: string; items: SettingItem[] };

export class PiSettingTab extends PluginSettingTab {
    declare update: () => void;
    plugin: PiPlugin;

    constructor(app: App, plugin: PiPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Legacy render path. Obsidian deprecated `display()` in 1.13 in favour of
     * `getSettingDefinitions()`, but it remains the entry point on older
     * versions. We walk the same definitions the declarative API returns so
     * the two surfaces can't drift.
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        for (const group of this.getSettingDefinitions()) {
            this.renderGroup(containerEl, group);
        }
    }

    getSettingDefinitions(): SettingGroupDefinition[] {
        return [
            {
                type: "group",
                heading: t("settings.title"),
                items: [
                    {
                        name: t("settings.piPath.name"),
                        desc: t("settings.piPath.desc"),
                        control: {
                            type: "text",
                            key: "piBinaryPath",
                            placeholder: t("settings.piPath.placeholder")
                        }
                    },
                    ...this.getInstructionItems(this.getPiPathInstructions()),
                    {
                        name: t("settings.nodePath.name"),
                        desc: t("settings.nodePath.desc"),
                        control: {
                            type: "text",
                            key: "nodePath",
                            placeholder: t("settings.nodePath.placeholder")
                        }
                    },
                    ...this.getInstructionItems(this.getNodePathInstructions()),
                    {
                        name: t("settings.rpcTimeout.name"),
                        desc: t("settings.rpcTimeout.desc"),
                        render: (setting: Setting) => {
                            this.renderRpcTimeoutSetting(setting);
                        }
                    },
                    {
                        name: t("settings.workingDir.name"),
                        desc: t("settings.workingDir.desc"),
                        control: {
                            type: "text",
                            key: "workingDirectory",
                            placeholder: t("settings.workingDir.placeholder")
                        }
                    },
                    {
                        name: t("settings.sessionDir.name"),
                        desc: t("settings.sessionDir.desc"),
                        control: {
                            type: "text",
                            key: "sessionSaveDir",
                            placeholder: t("settings.sessionDir.placeholder")
                        }
                    },
                    {
                        name: t("settings.persistSessions.name"),
                        desc: t("settings.persistSessions.desc"),
                        control: {
                            type: "toggle",
                            key: "persistSessions"
                        }
                    },
                    {
                        name: t("settings.thinkingLevel.name"),
                        desc: t("settings.thinkingLevel.desc"),
                        control: {
                            type: "dropdown",
                            key: "thinkingLevel",
                            options: {
                                off: t("settings.thinkingLevel.none"),
                                minimal: t("settings.thinkingLevel.minimal"),
                                low: t("settings.thinkingLevel.low"),
                                medium: t("settings.thinkingLevel.medium"),
                                high: t("settings.thinkingLevel.high"),
                                xhigh: t("settings.thinkingLevel.xhigh")
                            }
                        }
                    },
                    {
                        name: t("settings.defaultProvider.name"),
                        desc: t("settings.defaultProvider.desc"),
                        render: (setting: Setting) => {
                            this.renderProviderSetting(setting);
                        }
                    },
                    {
                        name: t("settings.defaultModel.name"),
                        desc: t("settings.defaultModel.desc"),
                        render: (setting: Setting) => {
                            this.renderModelSetting(setting);
                        }
                    }
                ]
            }
        ];
    }

    getControlValue<K extends keyof PiPluginSettings>(key: K): PiPluginSettings[K];
    getControlValue(key: string): unknown;
    getControlValue(key: string): unknown {
        if (!this.isSettingsKey(key)) return undefined;
        return this.plugin.settings[key];
    }

    async setControlValue<K extends keyof PiPluginSettings>(key: K, value: PiPluginSettings[K]): Promise<void>;
    async setControlValue(key: string, value: unknown): Promise<void>;
    async setControlValue(key: string, value: unknown): Promise<void> {
        if (!this.isSettingsKey(key)) {
            console.warn(`[pi] ignoring setControlValue for unknown key: ${key}`);
            return;
        }
        const expected = typeof DEFAULT_SETTINGS[key];
        if (typeof value !== expected) {
            console.warn(`[pi] ignoring setControlValue("${key}"): expected ${expected}, got ${typeof value}`);
            return;
        }
        // Sound cast: we just verified `key` is a real settings key and `value`
        // matches its declared primitive type.
        (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;

        if (key === "thinkingLevel") {
            this.plugin.settings.thinkingLevel = normalizeThinkingLevel(String(value));
        }

        await this.plugin.saveSettings();

        if (key === "thinkingLevel") {
            await this.plugin.applyThinkingLevelSetting(String(value));
        }
    }

    private isSettingsKey(key: string): key is keyof PiPluginSettings {
        return Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key) === true;
    }

    // ---------------------------------------------------------------------
    // Legacy-path renderers (walk the definitions returned above)
    // ---------------------------------------------------------------------

    private renderGroup(containerEl: HTMLElement, group: SettingGroupDefinition): void {
        new Setting(containerEl).setHeading().setName(group.heading);
        for (const item of group.items) {
            this.renderItem(containerEl, item);
        }
    }

    private renderItem(containerEl: HTMLElement, item: SettingItem): void {
        if ("searchable" in item && item.searchable === false) {
            containerEl.createEl("p", { text: item.desc, cls: "setting-item-description" });
            return;
        }

        const setting = new Setting(containerEl);
        if ("name" in item && item.name) setting.setName(item.name);
        if (item.desc) setting.setDesc(item.desc);

        if ("render" in item) {
            item.render(setting);
            return;
        }

        if ("control" in item) {
            this.applyControl(setting, item.control);
        }
    }

    private applyControl(setting: Setting, control: SettingControl): void {
        switch (control.type) {
            case "text":
                setting.addText((text) => {
                    if (control.placeholder) text.setPlaceholder(control.placeholder);
                    const current = this.getControlValue(control.key);
                    text.setValue(typeof current === "string" ? current : "");
                    text.onChange(async (value) => {
                        await this.setControlValue(control.key, value);
                    });
                });
                return;
            case "toggle":
                setting.addToggle((toggle) => {
                    const current = this.getControlValue(control.key);
                    toggle.setValue(current === true);
                    toggle.onChange(async (value) => {
                        await this.setControlValue(control.key, value);
                    });
                });
                return;
            case "dropdown":
                setting.addDropdown((dropdown) => {
                    for (const [optionKey, optionLabel] of Object.entries(control.options)) {
                        dropdown.addOption(optionKey, optionLabel);
                    }
                    const current = this.getControlValue(control.key);
                    dropdown.setValue(typeof current === "string" ? current : "");
                    dropdown.onChange(async (value) => {
                        await this.setControlValue(control.key, value);
                    });
                });
                return;
        }
    }

    private getInstructionItems(steps: string[]): SettingItem[] {
        return steps.map((step) => ({ desc: step, searchable: false as const }));
    }

    private getPiPathInstructions(): string[] {
        if (Platform.isMacOS) {
            return [t("settings.help.macosPi.step1"), t("settings.help.macosPi.step2"), t("settings.help.macosPi.step3"), t("settings.help.macosPi.step4")];
        }
        if (Platform.isWin) {
            return [t("settings.help.windowsPi.step1"), t("settings.help.windowsPi.powershell"), t("settings.help.windowsPi.cmd"), t("settings.help.windowsPi.step3"), t("settings.help.windowsPi.step4")];
        }
        if (Platform.isLinux) {
            return [t("settings.help.linuxPi.step1"), t("settings.help.linuxPi.step2")];
        }
        return [];
    }

    private getNodePathInstructions(): string[] {
        if (Platform.isMacOS) {
            return [t("settings.help.macosNode.step1"), t("settings.help.macosNode.step2"), t("settings.help.macosNode.step3"), t("settings.help.macosNode.step4")];
        }
        if (Platform.isWin) {
            return [t("settings.help.windowsNode.step1"), t("settings.help.windowsNode.powershell"), t("settings.help.windowsNode.cmd"), t("settings.help.windowsNode.step3"), t("settings.help.windowsNode.step4"), t("settings.help.windowsNode.step5")];
        }
        if (Platform.isLinux) {
            return [t("settings.help.linuxNode.step1"), t("settings.help.linuxNode.step2")];
        }
        return [];
    }

    // ---------------------------------------------------------------------
    // Custom render callbacks (slider + provider/model dropdowns that depend
    // on Pi's models.json and don't fit the declarative control schema)
    // ---------------------------------------------------------------------

    private renderRpcTimeoutSetting(setting: Setting): void {
        setting.clear();
        setting
            .setName(t("settings.rpcTimeout.name"))
            .setDesc(t("settings.rpcTimeout.desc"))
            // setDynamicTooltip() is deprecated in Obsidian 1.13+; the slider
            // now shows the value inline next to the control.
            .addSlider((slider) =>
                slider
                    .setLimits(10, 300, 10)
                    .setValue(this.plugin.settings.rpcTimeout / 1000)
                    .onChange(async (value) => {
                        this.plugin.settings.rpcTimeout = value * 1000;
                        await this.plugin.saveSettings();
                    })
            );
    }

    private renderProviderSetting(setting: Setting): void {
        const { providers, error } = readPiModelsConfig();

        if (error) {
            new Notice(error, 5000);
        }

        setting.clear();
        setting
            .setName(t("settings.defaultProvider.name"))
            .setDesc(t("settings.defaultProvider.desc"));

        if (providers.length > 0) {
            setting.addDropdown((dropdown) => {
                dropdown.addOption("", t("settings.defaultProvider.placeholder"));
                for (const provider of providers) {
                    dropdown.addOption(provider.name, provider.name);
                }
                dropdown.setValue(this.plugin.settings.defaultProvider);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.defaultProvider = value;
                    await this.plugin.saveSettings();
                    this.refreshSettingsTab();
                });
            });
        } else {
            setting.addText((text) =>
                text
                    .setPlaceholder(t("settings.defaultProvider.placeholder"))
                    .setValue(this.plugin.settings.defaultProvider)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultProvider = value.trim();
                        await this.plugin.saveSettings();
                    })
            );
        }

        // Append env-var hint as a sibling of the Setting (in settingEl.parentElement)
        // instead of polluting setting.descEl with a button.
        this.renderEnvVarHint(setting.settingEl, providers, this.plugin.settings.defaultProvider);
    }

    private renderModelSetting(setting: Setting): void {
        const { providers } = readPiModelsConfig();
        const currentProvider = this.plugin.settings.defaultProvider;
        const models = getProviderModels(providers, currentProvider);

        setting.clear();
        setting
            .setName(t("settings.defaultModel.name"))
            .setDesc(t("settings.defaultModel.desc"));

        if (models.length > 0) {
            setting.addDropdown((dropdown) => {
                dropdown.addOption("", t("settings.defaultModel.placeholder"));
                for (const model of models) {
                    dropdown.addOption(model.id, model.name);
                }
                dropdown.setValue(this.plugin.settings.defaultModel);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.defaultModel = value;
                    await this.plugin.saveSettings();
                });
            });
            return;
        }

        setting.addText((text) =>
            text
                .setPlaceholder(t("settings.defaultModel.placeholder"))
                .setValue(this.plugin.settings.defaultModel)
                .onChange(async (value) => {
                    this.plugin.settings.defaultModel = value.trim();
                    await this.plugin.saveSettings();
                })
        );
    }

    /**
     * Re-render the settings tab using the declarative settings API.
     */
    private refreshSettingsTab(): void {
        this.update();
    }

    /**
     * Render or refresh the env-var hint + add-key button as a sibling of the
     * provider Setting. Strategy: always rebuild the container, so we have a
     * single source of truth for its DOM shape.
     */
    private renderEnvVarHint(siblingEl: HTMLElement, providers: ProviderInfo[], providerName: string): void {
        const parentEl = siblingEl.parentElement;
        if (!parentEl) return;

        // Remove any prior hint container so we always rebuild from scratch.
        parentEl.querySelectorAll(".pi-env-var-container").forEach((el) => el.remove());

        const envVarName = getProviderEnvVarName(providers, providerName);
        if (!envVarName) return;

        const containerEl = parentEl.createDiv({ cls: "pi-env-var-container" });
        siblingEl.insertAdjacentElement("afterend", containerEl);

        const hintEl = containerEl.createDiv({ cls: "setting-item-description pi-env-var-hint" });
        hintEl.setText(t("settings.apiKeys.envVarHint", { envVar: envVarName }));

        const btnEl = containerEl.createEl("button", {
            cls: "pi-env-var-add-btn",
            attr: {
                "aria-label": t("settings.apiKeys.add.aria"),
                "data-tooltip-position": "top"
            }
        });

        const secretName = `pi-plugin-${envVarName.toLowerCase().replace(/_/g, "-")}`;
        const hasKey = !!this.app.secretStorage?.getSecret(secretName);

        if (hasKey) {
            btnEl.setText(t("settings.apiKeys.keyStored"));
            btnEl.disabled = true;
        } else {
            btnEl.setText(t("settings.apiKeys.add.name"));
            btnEl.onclick = () => {
                this.showApiKeyModal(envVarName);
            };
        }
    }

    private showApiKeyModal(envVar: string): void {
        const modal = new ApiKeyModal(this.app, envVar, (name: string, value: string): boolean => {
            return this.storeApiKey(name, value);
        });
        modal.open();
    }

    private storeApiKey(name: string, value: string): boolean {
        const secretName = `pi-plugin-${name.toLowerCase().replace(/_/g, "-")}`;
        // SecretStorage.setSecret is synchronous as of obsidian 1.11.4
        // (returns void). It throws if the id is not lowercase-alphanumeric
        // with optional dashes — surface that to the user instead of letting
        // it bubble silently out of the modal's click handler.
        try {
            this.app.secretStorage?.setSecret(secretName, value);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[Pi Plugin] Failed to store API key:", err);
            new Notice(t("notices.keyStoreFailed", { envVar: name, msg }));
            return false;
        }

        new Notice(t("notices.keyStored", { envVar: name }));
        void this.plugin.reconnectAfterKeyChange();
        this.refreshSettingsTab();
        return true;
    }
}

/**
 * Modal for adding/updating API key value.
 */
class ApiKeyModal extends Modal {
    private envVar: string;
    private onSave: (name: string, value: string) => boolean;
    private valueInput: HTMLInputElement;

    constructor(app: import('obsidian').App, envVar: string, onSave: (name: string, value: string) => boolean) {
        super(app);
        this.envVar = envVar;
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: t('settings.apiKeys.modal.edit') });

        // Value input (password)
        new Setting(contentEl)
            .setName(t('settings.apiKeys.modal.value'))
            .addText((text) => {
                text
                    .setPlaceholder(t('settings.apiKeys.modal.valuePlaceholder'))
                    .setValue('');
                text.inputEl.type = 'password';
                this.valueInput = text.inputEl;
                // Enable keyboard submit (Enter key)
                text.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.saveAndClose();
                    }
                });
            });

        // Save button
        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText(t('settings.apiKeys.modal.save'))
                    .setCta()
                    .onClick(() => this.saveAndClose())
            );
    }

    private saveAndClose(): void {
        const value = this.valueInput.value;
        if (!value) {
            new Notice(t('settings.apiKeys.modal.empty'));
            return;
        }
        if (this.onSave(this.envVar, value)) {
            this.close();
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
