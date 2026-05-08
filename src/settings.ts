import { App, PluginSettingTab, Setting } from "obsidian";
import type PiPlugin from "./main";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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

        containerEl.createEl("h2", { text: "Pi Plugin Settings" });

        // Pi binary path with platform-specific help
        this.createPiBinaryPathSetting(containerEl);

        // Node path with platform-specific help
        this.createNodePathSetting(containerEl);

        new Setting(containerEl)
            .setName("RPC timeout (seconds)")
            .setDesc("Timeout for RPC requests to Pi. Increase for slow operations like model switching.")
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
            .setName("Working directory")
            .setDesc("Working directory for Pi (empty = vault root). Note: Not supported on mobile.")
            .addText((text) =>
                text
                    .setPlaceholder("Leave empty for vault root")
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
            .setName("Session save directory")
            .setDesc("Vault directory for saved conversations")
            .addText((text) =>
                text
                    .setPlaceholder("Pi-Sessions")
                    .setValue(this.plugin.settings.sessionSaveDir)
                    .onChange(async (value) => {
                        this.plugin.settings.sessionSaveDir = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Persist sessions")
            .setDesc("Automatically save conversations as vault notes")
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
            .setName("Thinking level")
            .setDesc("Level of thinking/reasoning for the model")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("none", "None")
                    .addOption("low", "Low")
                    .addOption("medium", "Medium")
                    .addOption("high", "High")
                    .setValue(this.plugin.settings.thinkingLevel)
                    .onChange(async (value) => {
                        this.plugin.settings.thinkingLevel = value;
                        await this.plugin.saveSettings();
                    })
            );
    }

    private createPiBinaryPathSetting(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Pi binary path")
            .setDesc("Full path to the pi executable. Default: pi (uses PATH)")
            .addText((text) =>
                text
                    .setPlaceholder("pi")
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
            helpDiv.createEl("strong", { text: "macOS - Find your pi path:" });
            const macList = helpDiv.createEl("ul");
            macList.createEl("li", { text: "Open Terminal" });
            macList.createEl("li", { text: "Run: which pi" });
            macList.createEl("li", { text: "Copy the output (e.g. /Users/you/.nvm/versions/node/v24.15.0/bin/pi)" });
            macList.createEl("li", { text: "Paste it into the field above" });
        } else if (platform === "win32") {
            helpDiv.createEl("strong", { text: "Windows - Find your pi path:" });
            const winList = helpDiv.createEl("ul");
            winList.createEl("li", { text: "Open PowerShell or Command Prompt:" });
            const subList = winList.createEl("ul");
            subList.createEl("li", { text: "PowerShell: run Get-Command pi | Select-Object -ExpandProperty Source" });
            subList.createEl("li", { text: "CMD: run where pi" });
            winList.createEl("li", { text: "Copy the output and paste above" });
            winList.createEl("li", { text: "Note: Use forward slashes (/) or double backslashes (\\\\) in paths" });
        } else {
            helpDiv.createEl("strong", { text: "Linux - Find your pi path:" });
            const linuxList = helpDiv.createEl("ul");
            linuxList.createEl("li", { text: "Run: which pi" });
            linuxList.createEl("li", { text: "Or check your shell's PATH configuration" });
        }
    }

    private createNodePathSetting(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Node bin directory (optional)")
            .setDesc("Directory containing the node binary. Leave empty for auto-detection. Needed when GUI apps can't find node (nvm/fnm users).")
            .addText((text) =>
                text
                    .setPlaceholder("~/.nvm/versions/node/v24.15.0/bin")
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
            helpDiv.createEl("strong", { text: "macOS - Find your node directory:" });
            const macList = helpDiv.createEl("ul");
            macList.createEl("li", { text: "Open Terminal" });
            macList.createEl("li", { text: "Run: which node" });
            macList.createEl("li", { text: "The output will be like: /Users/you/.nvm/versions/node/v24.15.0/bin/node" });
            macList.createEl("li", { text: "Use the directory part (without /node): /Users/you/.nvm/versions/node/v24.15.0/bin" });
        } else if (platform === "win32") {
            helpDiv.createEl("strong", { text: "Windows - Find your node directory:" });
            const winList = helpDiv.createEl("ul");
            winList.createEl("li", { text: "Open PowerShell or Command Prompt:" });
            const subList = winList.createEl("ul");
            subList.createEl("li", { text: "PowerShell: run Get-Command node | Select-Object -ExpandProperty Source" });
            subList.createEl("li", { text: "CMD: run where node" });
            winList.createEl("li", { text: "The output will be like: C:\\Program Files\\nodejs\\node.exe" });
            winList.createEl("li", { text: "Use the directory part (without \\node.exe): C:\\Program Files\\nodejs" });
            winList.createEl("li", { text: "Note: Use forward slashes (/) or double backslashes (\\\\) in paths" });
        } else {
            helpDiv.createEl("strong", { text: "Linux - Find your node directory:" });
            const linuxList = helpDiv.createEl("ul");
            linuxList.createEl("li", { text: "Run: which node" });
            linuxList.createEl("li", { text: "Use the directory part (without /node)" });
        }
    }



    private createProviderModelSettings(containerEl: HTMLElement): void {
        // Read pi config to get defaults
        const piConfig = this.readPiConfig();
        const piDefaults = piConfig.settingsConfig;

        const defaultProvider = this.plugin.settings.defaultProvider || piDefaults?.defaultProvider || "";
        const defaultModel = this.plugin.settings.defaultModel || piDefaults?.defaultModel || "";

        const providerDesc = piDefaults?.defaultProvider
            ? `Default LLM provider (from Pi config: ${piDefaults.defaultProvider})`
            : "Default LLM provider (e.g. anthropic, openai)";

        const modelDesc = piDefaults?.defaultModel
            ? `Default model name (from Pi config: ${piDefaults.defaultModel})`
            : "Default model name (e.g. claude-sonnet-4)";

        new Setting(containerEl)
            .setName("Default provider")
            .setDesc(providerDesc)
            .addText((text) =>
                text
                    .setPlaceholder("Leave empty for Pi default")
                    .setValue(this.plugin.settings.defaultProvider)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultProvider = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Default model")
            .setDesc(modelDesc)
            .addText((text) =>
                text
                    .setPlaceholder("Leave empty for Pi default")
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