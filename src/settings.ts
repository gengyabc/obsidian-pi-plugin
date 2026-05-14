import { App, Platform, PluginSettingTab, Setting } from "obsidian";
import type PiPlugin from "./main";
import { t } from "./i18n/index";

export interface PiPluginSettings {
    piBinaryPath: string;
    nodePath: string;
    envVars: string;
    apiSecretNames: Record<string, string>;
    apiKeys: Record<string, string>;
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
    apiSecretNames: {},
    apiKeys: {},
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
                    .setLimits(10, 120, 5)
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

        this.createProviderModelSettings(containerEl);

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

        const helpDiv = containerEl.createDiv({ cls: "setting-item-description pi-platform-help" });

        if (Platform.isMacOS) {
            helpDiv.createEl("strong", { text: t("settings.help.macosPi.title") });
            const macList = helpDiv.createEl("ul");
            macList.createEl("li", { text: t("settings.help.macosPi.step1") });
            macList.createEl("li", { text: t("settings.help.macosPi.step2") });
            macList.createEl("li", { text: t("settings.help.macosPi.step3") });
            macList.createEl("li", { text: t("settings.help.macosPi.step4") });
        } else if (Platform.isWin) {
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

        const helpDiv = containerEl.createDiv({ cls: "setting-item-description pi-platform-help" });

        if (Platform.isMacOS) {
            helpDiv.createEl("strong", { text: t("settings.help.macosNode.title") });
            const macList = helpDiv.createEl("ul");
            macList.createEl("li", { text: t("settings.help.macosNode.step1") });
            macList.createEl("li", { text: t("settings.help.macosNode.step2") });
            macList.createEl("li", { text: t("settings.help.macosNode.step3") });
            macList.createEl("li", { text: t("settings.help.macosNode.step4") });
        } else if (Platform.isWin) {
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
        new Setting(containerEl)
            .setName(t("settings.defaultProvider.name"))
            .setDesc(t("settings.defaultProvider.desc"))
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
            .setDesc(t("settings.defaultModel.desc"))
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
}
