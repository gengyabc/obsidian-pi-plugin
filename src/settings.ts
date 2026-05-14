import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { Platform } from "obsidian";
import type PiPlugin from "./main";
import { t } from "./i18n/index";
import { loadPiModelsConfig, getProviderInfo, getRequiredEnvVars } from "./pi-config";

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

        // API keys section - uses SecretStorage
        this.createApiKeySettings(containerEl);

        // Platform-specific help sections
        if (Platform.isDesktop) {
            this.createPlatformHelpSections(containerEl);
        }
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
    }

    private createProviderModelSettings(containerEl: HTMLElement): void {
        const piConfig = loadPiModelsConfig();

        if (!piConfig) {
            const noConfigDiv = containerEl.createDiv({ cls: "setting-item-description" });
            noConfigDiv.setText(t("settings.apiKeys.noConfig"));
            return;
        }

        const providerNames = Object.keys(piConfig.providers);
        const selectedProvider = this.plugin.settings.defaultProvider;
        const selectedModel = this.plugin.settings.defaultModel;

        // Get models for selected provider
        const getModelsForProvider = (providerName: string): string[] => {
            const providerConfig = piConfig.providers[providerName];
            if (!providerConfig?.models) return [];
            return providerConfig.models.map((m) => m.id);
        };

        const modelsForSelectedProvider = selectedProvider ? getModelsForProvider(selectedProvider) : [];

        // Provider dropdown
        new Setting(containerEl)
            .setName(t("settings.defaultProvider.name"))
            .setDesc(t("settings.defaultProvider.desc"))
            .addDropdown((dropdown) => {
                // Add empty option at top
                dropdown.addOption("", t("settings.defaultProvider.placeholder"));
                // Add all providers
                for (const providerName of providerNames) {
                    dropdown.addOption(providerName, providerName);
                }
                dropdown.setValue(selectedProvider);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.defaultProvider = value;
                    // Auto-select first model for new provider
                    if (value) {
                        const models = getModelsForProvider(value);
                        if (models.length > 0) {
                            this.plugin.settings.defaultModel = models[0];
                        } else {
                            this.plugin.settings.defaultModel = "";
                        }
                    } else {
                        this.plugin.settings.defaultModel = "";
                    }
                    await this.plugin.saveSettings();
                    // Re-check API keys and refresh UI
                    await this.plugin.checkMissingApiKeys();
                    this.display(); // Refresh to update model dropdown and API key status
                });
            });

        // Model dropdown - populated based on selected provider
        new Setting(containerEl)
            .setName(t("settings.defaultModel.name"))
            .setDesc(t("settings.defaultModel.desc"))
            .addDropdown((dropdown) => {
                // Add empty option at top
                dropdown.addOption("", t("settings.defaultModel.placeholder"));
                // Add models for selected provider
                if (selectedProvider && modelsForSelectedProvider.length > 0) {
                    for (const modelId of modelsForSelectedProvider) {
                        // Find model name for better display
                        const providerConfig = piConfig.providers[selectedProvider];
                        const modelInfo = providerConfig?.models?.find((m) => m.id === modelId);
                        const displayName = modelInfo?.name || modelId;
                        dropdown.addOption(modelId, displayName);
                    }
                }
                dropdown.setValue(selectedModel);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.defaultModel = value;
                    await this.plugin.saveSettings();
                });
            });
    }

    /**
     * Create API key input fields using Obsidian's SecretStorage.
     * Reads required env vars from Pi's models.json and shows password input for each.
     * Keys are stored securely in system keychain via SecretStorage.
     * Highlights the key required for the currently selected provider.
     */
    private async createApiKeySettings(containerEl: HTMLElement): Promise<void> {
        new Setting(containerEl).setHeading().setName(t("settings.apiKeys.heading"));

        const piConfig = loadPiModelsConfig();

        if (!piConfig) {
            const noConfigDiv = containerEl.createDiv({ cls: "setting-item-description" });
            noConfigDiv.setText(t("settings.apiKeys.noConfig"));
            return;
        }

        const providers = getProviderInfo(piConfig);
        const requiredEnvVars = getRequiredEnvVars(piConfig);

        // Determine which env var is required for selected provider
        const selectedProvider = this.plugin.settings.defaultProvider;
        const selectedProviderConfig = selectedProvider ? piConfig.providers[selectedProvider] : null;
        const requiredEnvVarForSelected = selectedProviderConfig?.apiKey;

        // Info explaining keys are stored securely, plus which key is needed for selected provider
        const infoDiv = containerEl.createDiv({ cls: "setting-item-description" });
        if (requiredEnvVarForSelected) {
            const secretName = `pi-plugin-${requiredEnvVarForSelected.toLowerCase().replace(/_/g, "-")}`;
            const key = await this.app.secretStorage.getSecret(secretName);
            const hasKey = !!key;
            infoDiv.setText(t("settings.apiKeys.selectedProviderInfo", {
                provider: selectedProvider,
                envVar: requiredEnvVarForSelected,
                status: hasKey ? t("settings.apiKeys.keySet") : t("settings.apiKeys.keyMissing")
            }));
        } else {
            infoDiv.setText(t("settings.apiKeys.info"));
        }

        // Create password input for each required env var
        for (const envVar of requiredEnvVars) {
            const providerNames = providers
                .filter((p) => p.envVar === envVar)
                .map((p) => p.name);

            const secretName = `pi-plugin-${envVar.toLowerCase().replace(/_/g, "-")}`;
            const existingKey = await this.app.secretStorage.getSecret(secretName);
            const hasKey = !!existingKey;
            const isRequiredForSelected = envVar === requiredEnvVarForSelected;

            new Setting(containerEl)
                .setName(isRequiredForSelected ? `${envVar} ✓` : envVar)
                .setDesc(t("settings.apiKeys.usedBy", { providers: providerNames.join(", "), stored: hasKey ? t("settings.apiKeys.keyStored") : "" }))
                .addText((text) => {
                    text
                        .setPlaceholder(hasKey ? t("settings.apiKeys.enterNew") : t("settings.apiKeys.placeholder"))
                        .setValue("") // Always show empty for security
                        .inputEl.type = "password";
                    text.inputEl.addClass("pi-api-key-input");
                    
                    // Highlight the input for selected provider's key
                    if (isRequiredForSelected) {
                        text.inputEl.addClass("pi-api-key-required");
                    }
                    
                    text.inputEl.addEventListener("change", async () => {
                        const value = text.inputEl.value;
                        if (value) {
                            // Store the key in SecretStorage
                            await this.app.secretStorage.setSecret(secretName, value);
                            text.inputEl.value = "";
                            text.setPlaceholder(t("settings.apiKeys.keyStored"));
                            new Notice(t("notices.keyStored", { envVar }));
                            // Reconnect to pick up the new key (async, no await needed)
                            this.plugin.reconnectAfterKeyChange();
                            // Refresh to update status
                            this.display();
                        }
                    });
                })
                .settingEl.addClass("pi-api-key-setting");
        }

        // Refresh button to reload providers
        new Setting(containerEl)
            .setName(t("settings.apiKeys.refresh"))
            .setDesc(t("settings.apiKeys.refreshDesc"))
            .addButton((btn) =>
                btn
                    .setIcon("refresh-cw")
                    .setTooltip(t("settings.apiKeys.refreshTooltip"))
                    .onClick(() => {
                        this.display();
                    })
            );
    }

    private createPlatformHelpSections(containerEl: HTMLElement): void {
        // macOS help
        if (Platform.isMacOS) {
            const macOSDiv = containerEl.createDiv({ cls: "pi-platform-help" });
            macOSDiv.createEl("strong", { text: t("settings.help.macosPi.title") });

            const steps = [
                t("settings.help.macosPi.step1"),
                t("settings.help.macosPi.step2"),
                t("settings.help.macosPi.step3"),
                t("settings.help.macosPi.step4"),
            ];

            for (const step of steps) {
                macOSDiv.createEl("p", { text: step, cls: "setting-item-description" });
            }
        }

        // Windows help
        if (Platform.isWin) {
            const winDiv = containerEl.createDiv({ cls: "pi-platform-help" });
            winDiv.createEl("strong", { text: t("settings.help.windowsPi.title") });

            const steps = [
                t("settings.help.windowsPi.step1"),
                t("settings.help.windowsPi.powershell"),
                t("settings.help.windowsPi.cmd"),
                t("settings.help.windowsPi.step3"),
                t("settings.help.windowsPi.step4"),
            ];

            for (const step of steps) {
                winDiv.createEl("p", { text: step, cls: "setting-item-description" });
            }
        }

        // Linux help
        if (Platform.isLinux) {
            const linuxDiv = containerEl.createDiv({ cls: "pi-platform-help" });
            linuxDiv.createEl("strong", { text: t("settings.help.linuxPi.title") });

            const steps = [t("settings.help.linuxPi.step1"), t("settings.help.linuxPi.step2")];

            for (const step of steps) {
                linuxDiv.createEl("p", { text: step, cls: "setting-item-description" });
            }
        }
    }
}