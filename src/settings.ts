import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import { Platform } from "obsidian";
import type PiPlugin from "./main";
import { t } from "./i18n/index";

import { readPiModelsConfig, getProviderEnvVarName, getProviderModels, ProviderInfo } from "./pi-config-reader";

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

export class PiSettingTab extends PluginSettingTab {
    plugin: PiPlugin;

    constructor(app: App, plugin: PiPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl).setHeading().setName(t("settings.title"));

        this.createPiBinaryPathSetting(containerEl);
        this.createNodePathSetting(containerEl);

        new Setting(containerEl)
            .setName(t("settings.rpcTimeout.name"))
            .setDesc(t("settings.rpcTimeout.desc"))
            .addSlider((slider) =>
                slider
                    .setLimits(10, 300, 10)
                    .setValue(this.plugin.settings.rpcTimeout / 1000)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.rpcTimeout = value * 1000;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.workingDir.name"))
            .setDesc(t("settings.workingDir.desc"))
            .addText((text) =>
                text
                    .setPlaceholder(t("settings.workingDir.placeholder"))
                    .setValue(this.plugin.settings.workingDirectory)
                    .onChange(async (value) => {
                        this.plugin.settings.workingDirectory = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.sessionDir.name"))
            .setDesc(t("settings.sessionDir.desc"))
            .addText((text) =>
                text
                    .setPlaceholder(t("settings.sessionDir.placeholder"))
                    .setValue(this.plugin.settings.sessionSaveDir)
                    .onChange(async (value) => {
                        this.plugin.settings.sessionSaveDir = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.persistSessions.name"))
            .setDesc(t("settings.persistSessions.desc"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.persistSessions)
                    .onChange(async (value) => {
                        this.plugin.settings.persistSessions = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.thinkingLevel.name"))
            .setDesc(t("settings.thinkingLevel.desc"))
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("none", t("settings.thinkingLevel.none"))
                    .addOption("low", t("settings.thinkingLevel.low"))
                    .addOption("medium", t("settings.thinkingLevel.medium"))
                    .addOption("high", t("settings.thinkingLevel.high"))
                    .setValue(this.plugin.settings.thinkingLevel)
                    .onChange(async (value) => {
                        this.plugin.settings.thinkingLevel = value;
                        await this.plugin.saveSettings();
                    })
            );

        this.createProviderModelSettings(containerEl);
    }

    private createPiBinaryPathSetting(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName(t("settings.piPath.name"))
            .setDesc(t("settings.piPath.desc"))
            .addText((text) =>
                text
                    .setPlaceholder(t("settings.piPath.placeholder"))
                    .setValue(this.plugin.settings.piBinaryPath)
                    .onChange(async (value) => {
                        this.plugin.settings.piBinaryPath = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Pi path instructions
        if (Platform.isMacOS) {
            for (const step of [t("settings.help.macosPi.step1"), t("settings.help.macosPi.step2"), t("settings.help.macosPi.step3"), t("settings.help.macosPi.step4")]) {
                containerEl.createEl("p", { text: step, cls: "setting-item-description" });
            }
        } else if (Platform.isWin) {
            for (const step of [t("settings.help.windowsPi.step1"), t("settings.help.windowsPi.powershell"), t("settings.help.windowsPi.cmd"), t("settings.help.windowsPi.step3"), t("settings.help.windowsPi.step4")]) {
                containerEl.createEl("p", { text: step, cls: "setting-item-description" });
            }
        } else if (Platform.isLinux) {
            for (const step of [t("settings.help.linuxPi.step1"), t("settings.help.linuxPi.step2")]) {
                containerEl.createEl("p", { text: step, cls: "setting-item-description" });
            }
        }
    }

    private createNodePathSetting(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName(t("settings.nodePath.name"))
            .setDesc(t("settings.nodePath.desc"))
            .addText((text) =>
                text
                    .setPlaceholder(t("settings.nodePath.placeholder"))
                    .setValue(this.plugin.settings.nodePath)
                    .onChange(async (value) => {
                        this.plugin.settings.nodePath = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Node path instructions
        if (Platform.isMacOS) {
            for (const step of [t("settings.help.macosNode.step1"), t("settings.help.macosNode.step2"), t("settings.help.macosNode.step3"), t("settings.help.macosNode.step4")]) {
                containerEl.createEl("p", { text: step, cls: "setting-item-description" });
            }
        } else if (Platform.isWin) {
            for (const step of [t("settings.help.windowsNode.step1"), t("settings.help.windowsNode.powershell"), t("settings.help.windowsNode.cmd"), t("settings.help.windowsNode.step3"), t("settings.help.windowsNode.step4"), t("settings.help.windowsNode.step5")]) {
                containerEl.createEl("p", { text: step, cls: "setting-item-description" });
            }
        } else if (Platform.isLinux) {
            for (const step of [t("settings.help.linuxNode.step1"), t("settings.help.linuxNode.step2")]) {
                containerEl.createEl("p", { text: step, cls: "setting-item-description" });
            }
        }
    }



    private createProviderModelSettings(containerEl: HTMLElement): void {
        // Read Pi's models.json to get available providers
        const { providers, error } = readPiModelsConfig();

        // Show error notice if config exists but failed to parse
        if (error) {
            new Notice(error, 5000);
        }

        // Provider dropdown with env var hint and quick-add button
        const providerSetting = new Setting(containerEl)
            .setName(t("settings.defaultProvider.name"))
            .setDesc(t("settings.defaultProvider.desc"));

        // Container for env var hint + add button
        const envVarContainerEl = containerEl.createDiv({ cls: "pi-env-var-container" });
        const envVarHintEl = envVarContainerEl.createDiv({ cls: "setting-item-description pi-env-var-hint" });
        envVarContainerEl.hide();

        if (providers.length > 0) {
            providerSetting.addDropdown((dropdown) => {
                // Add empty option first
                dropdown.addOption("", t("settings.defaultProvider.placeholder"));
                // Add all providers from Pi's config
                for (const provider of providers) {
                    dropdown.addOption(provider.name, provider.name);
                }
                dropdown.setValue(this.plugin.settings.defaultProvider);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.defaultProvider = value;
                    await this.plugin.saveSettings();

                    // Update env var hint and add button
                    this.updateEnvVarHint(envVarContainerEl, envVarHintEl, providers, value);

                    // Refresh to update model dropdown
                    this.display();
                });
            });

            // Show env var hint for current provider if set
            if (this.plugin.settings.defaultProvider) {
                this.updateEnvVarHint(envVarContainerEl, envVarHintEl, providers, this.plugin.settings.defaultProvider);
            }
        } else {
            // Fallback to text field if no providers found
            providerSetting.addText((text) =>
                text
                    .setPlaceholder(t("settings.defaultProvider.placeholder"))
                    .setValue(this.plugin.settings.defaultProvider)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultProvider = value.trim();
                        await this.plugin.saveSettings();
                    })
            );
        }

        // Model dropdown for selected provider
        const modelSetting = new Setting(containerEl)
            .setName(t("settings.defaultModel.name"))
            .setDesc(t("settings.defaultModel.desc"));

        const currentProvider = this.plugin.settings.defaultProvider;
        const models = getProviderModels(providers, currentProvider);

        if (models.length > 0) {
            modelSetting.addDropdown((dropdown) => {
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
        } else {
            // Fallback to text field if no models found for provider
            modelSetting.addText((text) =>
                text
                    .setPlaceholder(t("settings.defaultModel.placeholder"))
                    .setValue(this.plugin.settings.defaultModel)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultModel = value.trim();
                        await this.plugin.saveSettings();
                    })
            );
        }
    }

    /** Update env var hint and add button for selected provider */
    private updateEnvVarHint(
        containerEl: HTMLElement,
        hintEl: HTMLElement,
        providers: ProviderInfo[],
        providerName: string
    ): void {
        // Clear previous content
        hintEl.empty();

        // Get or create button element (reuse if exists)
        let btnEl = containerEl.querySelector<HTMLButtonElement>(".pi-env-var-add-btn");
        if (!btnEl) {
            btnEl = containerEl.createEl("button", {
                cls: "pi-env-var-add-btn",
                attr: {
                    "aria-label": t("settings.apiKeys.add.aria"),
                    "data-tooltip-position": "top"
                }
            });
        }

        const envVarName = getProviderEnvVarName(providers, providerName);
        if (envVarName) {
            // Check if key is already configured
            const secretName = `pi-plugin-${envVarName.toLowerCase().replace(/_/g, "-")}`;
            const key = this.app.secretStorage?.getSecret(secretName);
            const hasKey = !!key;

            hintEl.setText(t("settings.apiKeys.envVarHint", { envVar: envVarName }));

            // Update button state
            if (hasKey) {
                btnEl.setText(t("settings.apiKeys.keyStored"));
                btnEl.disabled = true;
            } else {
                btnEl.setText(t("settings.apiKeys.add.name"));
                btnEl.disabled = false;
                // Remove old listeners and add new one
                btnEl.onclick = () => {
                    this.showApiKeyModal(envVarName);
                };
            }

            containerEl.show();
        } else {
            containerEl.hide();
        }
    }

    private showApiKeyModal(envVar: string): void {
        const modal = new ApiKeyModal(this.app, envVar, (name: string, value: string) => {
            this.storeApiKey(name, value);
        });
        modal.open();
    }

    private storeApiKey(name: string, value: string): void {
        const secretName = `pi-plugin-${name.toLowerCase().replace(/_/g, "-")}`;
        // SecretStorage.setSecret is synchronous as of obsidian 1.11.4
        // (returns void). Keep this method sync so the lint rule against
        // async-without-await is satisfied honestly.
        this.app.secretStorage?.setSecret(secretName, value);

        new Notice(t("notices.keyStored", { envVar: name }));
        void this.plugin.reconnectAfterKeyChange();
        this.display();
    }
}

/**
 * Modal for adding/updating API key value.
 */
class ApiKeyModal extends Modal {
    private envVar: string;
    private onSave: (name: string, value: string) => void;
    private valueInput: HTMLInputElement;

    constructor(app: import('obsidian').App, envVar: string, onSave: (name: string, value: string) => void) {
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
        this.onSave(this.envVar, value);
        this.close();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
