import { App, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import type PiPlugin from "./main";

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
 * Mapping from provider name to standard env var name.
 */
export const API_KEY_ENV_VARS: Record<string, string> = {
    bailian: "BAILIAN_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    gemini: "GOOGLE_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
};

/**
 * Default secret names for each provider.
 */
export const DEFAULT_SECRET_NAMES: Record<string, string> = {
    anthropic: "pi-anthropic-key",
    openai: "pi-openai-key",
    bailian: "pi-bailian-key",
    gemini: "pi-gemini-key",
    deepseek: "pi-deepseek-key",
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

        containerEl.createEl("h2", { text: "Pi Plugin Settings" });

        // Core settings
        new Setting(containerEl)
            .setName("Pi binary path")
            .setDesc("Full path to the pi executable, including filename (e.g. ~/.nvm/versions/node/v24.15.0/bin/pi). Default: pi")
            .addText((text) =>
                text
                    .setPlaceholder("pi")
                    .setValue(this.plugin.settings.piBinaryPath)
                    .onChange(async (value) => {
                        this.plugin.settings.piBinaryPath = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Node bin directory (optional)")
            .setDesc("Directory containing the node binary (NOT the node binary itself). Leave empty for auto-detection. Needed when GUI apps can't find node (e.g. nvm/fnm users). Example: ~/.nvm/versions/node/v24.15.0/bin")
            .addText((text) =>
                text
                    .setPlaceholder("~/.nvm/versions/node/v24.15.0/bin")
                    .setValue(this.plugin.settings.nodePath)
                    .onChange(async (value) => {
                        this.plugin.settings.nodePath = value;
                        await this.plugin.saveSettings();
                    })
            );

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

        // API Keys section - using SecretStorage
        containerEl.createEl("h3", { text: "API Keys (Secure Storage)" });
        containerEl.createEl("p", {
            text: "API keys are stored securely in your system keychain (macOS Keychain, Windows Credential Manager, Linux libsecret). This is safer than storing keys in plain text files that may sync across devices.",
            cls: "setting-item-description"
        });

        // Helper to create secret setting
        const createSecretSetting = (provider: string, displayName: string, description: string) => {
            const defaultSecretName = DEFAULT_SECRET_NAMES[provider] || `pi-${provider}-key`;
            const currentSecretName = this.plugin.settings.apiSecretNames?.[provider] || "";

            new Setting(containerEl)
                .setName(displayName)
                .setDesc(description)
                .addComponent((el) => {
                    return new SecretComponent(this.app, el)
                        .setValue(currentSecretName)
                        .onChange(async (value) => {
                            if (value) {
                                this.plugin.settings.apiSecretNames = {
                                    ...this.plugin.settings.apiSecretNames,
                                    [provider]: value,
                                };
                            } else {
                                // Remove the entry if cleared
                                const updated = { ...this.plugin.settings.apiSecretNames };
                                delete updated[provider];
                                this.plugin.settings.apiSecretNames = updated;
                            }
                            await this.plugin.saveSettings();
                        });
                });
        };

        createSecretSetting("anthropic", "Anthropic API Key", "API key for Claude models (stored securely)");
        createSecretSetting("openai", "OpenAI API Key", "API key for GPT models (stored securely)");
        createSecretSetting("bailian", "Bailian API Key", "API key for Bailian/Alibaba Cloud models (stored securely)");
        createSecretSetting("gemini", "Gemini API Key", "API key for Google Gemini models (stored securely)");
        createSecretSetting("deepseek", "DeepSeek API Key", "API key for DeepSeek models (stored securely)");

        // Environment variables section (alternative approach)
        containerEl.createEl("h3", { text: "Environment Variables (Alternative)" });
        containerEl.createEl("p", {
            text: "Alternatively, you can use environment variables. This requires platform-specific setup to make env vars visible to GUI apps.",
            cls: "setting-item-description"
        });

        new Setting(containerEl)
            .setName("Environment variables (optional)")
            .setDesc("Comma-separated env var names to pass to Pi (e.g. BAILIAN_API_KEY,OPENAI_API_KEY). GUI apps don't inherit shell env vars, so API keys set in your shell profile won't be visible to Obsidian.")
            .addText((text) =>
                text
                    .setPlaceholder("BAILIAN_API_KEY")
                    .setValue(this.plugin.settings.envVars)
                    .onChange(async (value) => {
                        this.plugin.settings.envVars = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Platform-specific instructions
        containerEl.createEl("p", { text: "To make env vars visible to GUI apps:", cls: "setting-item-description" });
        const envInstructions = containerEl.createEl("ul", { cls: "setting-item-description" });
        envInstructions.createEl("li", { text: 'macOS: launchctl setenv VAR_NAME "value" (then restart Obsidian)' });
        envInstructions.createEl("li", { text: 'Linux: Add to ~/.pam_environment or ~/.config/environment.d/*.conf (then restart)' });
        envInstructions.createEl("li", { text: 'Windows: Use setx VAR_NAME "value" in terminal (then restart Obsidian)' });

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

        // Default provider and model
        new Setting(containerEl)
            .setName("Default provider")
            .setDesc("Default LLM provider (e.g. anthropic, openai)")
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
            .setDesc("Default model name (e.g. claude-sonnet-4)")
            .addText((text) =>
                text
                    .setPlaceholder("Leave empty for Pi default")
                    .setValue(this.plugin.settings.defaultModel)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultModel = value;
                        await this.plugin.saveSettings();
                    })
            );

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
}