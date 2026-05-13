import { App, PluginSettingTab, Setting } from "obsidian";
import type PiPlugin from "./main";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { t } from "./i18n/index";

export interface PiPluginSettings {
    piBinaryPath: string;
    nodePath: string;
    envVars: string;
    // Secret names for API keys (stored in Obsidian's SecretStorage)
    // These are names like "pi-anthropic-key", not the actual keys
    apiSecretNames: Record<string, string>;
    // Legacy: direct API key storage (deprecated, for migration)
    apiKeys: Record<string, string>;
    workingDirectory: string;
    defaultProvider: string;
    defaultModel: string;
    sessionSaveDir: string;
    persistSessions: boolean;
    thinkingLevel: string;
    rpcTimeout: number;  // milliseconds
}

export const DEFAULT_SETTINGS: PiPluginSettings = {
    piBinaryPath: "pi",
    nodePath: "",  // empty = auto-detect
    envVars: "",  // comma-separated env var names to pass
    apiSecretNames: {},  // provider -> secret name (e.g. {"anthropic": "pi-anthropic-key"})
    apiKeys: {},  // DEPRECATED: legacy direct key storage (for migration)
    workingDirectory: "",  // empty = vault root
    defaultProvider: "",
    defaultModel: "",
    sessionSaveDir: "Pi-Sessions",
    persistSessions: true,
    thinkingLevel: "medium",
    rpcTimeout: 60_000,  // 60 seconds default
};

/**
 * Pi models.json structure (simplified)
 */
interface PiModelsConfig {
    providers?: Record<string, {
        apiKey?: string;
        models?: Array<{ id: string; name?: string }>;
    }>;
}

/**
 * Pi settings.json structure (simplified)
 */
interface PiSettingsConfig {
    defaultProvider?: string;
    defaultModel?: string;
}

export class PiSettingTab extends PluginSettingTab {
    plugin: PiPlugin;

    constructor(app: App, plugin: PiPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: t("settings.title") });

        // Pi binary path with platform-specific help
        this.createPiBinaryPathSetting(containerEl);

        // Node path with platform-specific help
        this.createNodePathSetting(containerEl);

        new Setting(containerEl)
            .setName(t("settings.rpcTimeout.name"))
            .setDesc(t("settings.rpcTimeout.desc"))
            .addSlider((slider) =>
                slider
                    .setLimits(10, 120, 5)
                    .setValue(this.plugin.settings.rpcTimeout / 1000)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.rpcTimeout = value * 1000;
                        await this.plugin.saveSettings();
                    })
            );

        // Working directory
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

        // Default provider and model (pre-fill from pi config)
        this.createProviderModelSettings(containerEl);

        // Session persistence
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

        // Thinking level
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

        // Platform-specific instructions
        const platform = os.platform();
        const helpDiv = containerEl.createDiv({ cls: "setting-item-description" });
        helpDiv.style.marginLeft = "0";
        helpDiv.style.marginTop = "0.5em";
        helpDiv.style.marginBottom = "1em";

        if (platform === "darwin") {
            helpDiv.createEl("strong", { text: t("settings.help.macosPi.title") });
            const macList = helpDiv.createEl("ul");
            macList.createEl("li", { text: t("settings.help.macosPi.step1") });
            macList.createEl("li", { text: t("settings.help.macosPi.step2") });
            macList.createEl("li", { text: t("settings.help.macosPi.step3") });
            macList.createEl("li", { text: t("settings.help.macosPi.step4") });
        } else if (platform === "win32") {
            helpDiv.createEl("strong", { text: t("settings.help.windowsPi.title") });
            const winList = helpDiv.createEl("ul");
            winList.createEl("li", { text: t("settings.help.windowsPi.step1") });
            const subList = winList.createEl("ul");
            subList.createEl("li", { text: t("settings.help.windowsPi.powershell") });
            subList.createEl("li", { text: t("settings.help.windowsPi.cmd") });
            winList.createEl("li", { text: t("settings.help.windowsPi.step3") });
            winList.createEl("li", { text: t("settings.help.windowsPi.step4") });
        } else {
            helpDiv.createEl("strong", { text: t("settings.help.linuxPi.title") });
            const linuxList = helpDiv.createEl("ul");
            linuxList.createEl("li", { text: t("settings.help.linuxPi.step1") });
            linuxList.createEl("li", { text: t("settings.help.linuxPi.step2") });
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

        // Platform-specific instructions
        const platform = os.platform();
        const helpDiv = containerEl.createDiv({ cls: "setting-item-description" });
        helpDiv.style.marginLeft = "0";
        helpDiv.style.marginTop = "0.5em";
        helpDiv.style.marginBottom = "1em";

        if (platform === "darwin") {
            helpDiv.createEl("strong", { text: t("settings.help.macosNode.title") });
            const macList = helpDiv.createEl("ul");
            macList.createEl("li", { text: t("settings.help.macosNode.step1") });
            macList.createEl("li", { text: t("settings.help.macosNode.step2") });
            macList.createEl("li", { text: t("settings.help.macosNode.step3") });
            macList.createEl("li", { text: t("settings.help.macosNode.step4") });
        } else if (platform === "win32") {
            helpDiv.createEl("strong", { text: t("settings.help.windowsNode.title") });
            const winList = helpDiv.createEl("ul");
            winList.createEl("li", { text: t("settings.help.windowsNode.step1") });
            const subList = winList.createEl("ul");
            subList.createEl("li", { text: t("settings.help.windowsNode.powershell") });
            subList.createEl("li", { text: t("settings.help.windowsNode.cmd") });
            winList.createEl("li", { text: t("settings.help.windowsNode.step3") });
            winList.createEl("li", { text: t("settings.help.windowsNode.step4") });
            winList.createEl("li", { text: t("settings.help.windowsNode.step5") });
        } else {
            helpDiv.createEl("strong", { text: t("settings.help.linuxNode.title") });
            const linuxList = helpDiv.createEl("ul");
            linuxList.createEl("li", { text: t("settings.help.linuxNode.step1") });
            linuxList.createEl("li", { text: t("settings.help.linuxNode.step2") });
        }
    }



    private createProviderModelSettings(containerEl: HTMLElement): void {
        // Read pi config to get defaults
        const piConfig = this.readPiConfig();
        const piDefaults = piConfig.settingsConfig;

        const defaultProvider = this.plugin.settings.defaultProvider || piDefaults?.defaultProvider || "";
        const defaultModel = this.plugin.settings.defaultModel || piDefaults?.defaultModel || "";

        const providerDesc = piDefaults?.defaultProvider
            ? t("settings.defaultProvider.descConfig", { provider: piDefaults.defaultProvider })
            : t("settings.defaultProvider.desc");

        const modelDesc = piDefaults?.defaultModel
            ? t("settings.defaultModel.descConfig", { model: piDefaults.defaultModel })
            : t("settings.defaultModel.desc");

        new Setting(containerEl)
            .setName(t("settings.defaultProvider.name"))
            .setDesc(providerDesc)
            .addText((text) =>
                text
                    .setPlaceholder(t("settings.defaultProvider.placeholder"))
                    .setValue(this.plugin.settings.defaultProvider)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultProvider = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.defaultModel.name"))
            .setDesc(modelDesc)
            .addText((text) =>
                text
                    .setPlaceholder(t("settings.defaultModel.placeholder"))
                    .setValue(this.plugin.settings.defaultModel)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultModel = value;
                        await this.plugin.saveSettings();
                    })
            );
    }

    /**
     * Read pi's configuration files.
     */
    private readPiConfig(): { modelsConfig: PiModelsConfig | null; settingsConfig: PiSettingsConfig | null } {
        const homeDir = os.homedir();
        const piAgentDir = path.join(homeDir, ".pi", "agent");

        let modelsConfig: PiModelsConfig | null = null;
        let settingsConfig: PiSettingsConfig | null = null;

        try {
            const modelsPath = path.join(piAgentDir, "models.json");
            if (fs.existsSync(modelsPath)) {
                const content = fs.readFileSync(modelsPath, "utf-8");
                modelsConfig = JSON.parse(content);
            }
        } catch (err) {
            console.warn("[Pi Plugin] Failed to read models.json:", err);
        }

        try {
            const settingsPath = path.join(piAgentDir, "settings.json");
            if (fs.existsSync(settingsPath)) {
                const content = fs.readFileSync(settingsPath, "utf-8");
                settingsConfig = JSON.parse(content);
            }
        } catch (err) {
            console.warn("[Pi Plugin] Failed to read settings.json:", err);
        }

        return { modelsConfig, settingsConfig };
    }
}
