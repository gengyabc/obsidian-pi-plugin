import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
    App: class {},
    FuzzySuggestModal: class {},
    Notice: class {},
    Plugin: class {},
    WorkspaceLeaf: class {},
}));

vi.mock("./notices", () => ({
    showCriticalNotice: vi.fn(),
}));

vi.mock("./rpc", () => ({
    PiConnection: class {},
}));

vi.mock("./view", () => ({
    PiChatView: class {},
    VIEW_TYPE_PI_CHAT: "pi-chat-view",
}));

vi.mock("./sessions", () => ({
    SessionManager: class {},
}));

vi.mock("./session-list", () => ({
    SessionListModal: class {},
    buildSessionEntries: vi.fn(() => []),
}));

vi.mock("./statusbar", () => ({
    PiStatusBar: class {},
}));

vi.mock("./commands", () => ({
    CommandSuggest: class {},
}));

vi.mock("./message-store", () => ({
    MessageStore: class {},
}));

vi.mock("./i18n/index", () => ({
    t: vi.fn((key: string) => key),
}));

describe("PiPlugin thinking level sync", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.assign(globalThis, { window: globalThis });
    });

    it("reapplies the configured thinking level after connecting", async () => {
        const { default: PiPlugin } = await import("./main");
        const applyThinkingLevelSetting = vi.fn().mockResolvedValue(undefined);
        const refreshModel = vi.fn().mockResolvedValue(undefined);
        const refreshStats = vi.fn().mockResolvedValue(undefined);
        const registerPiCommands = vi.fn().mockResolvedValue(undefined);

        const plugin = {
            settings: { thinkingLevel: "low" },
            statusBar: { refreshModel, refreshStats },
            applyThinkingLevelSetting,
            registerPiCommands,
        };

        (PiPlugin.prototype as unknown as { scheduleConnectionReadyRefresh: () => void }).scheduleConnectionReadyRefresh.call(plugin);

        await vi.advanceTimersByTimeAsync(1000);

        expect(applyThinkingLevelSetting).toHaveBeenCalledWith("low");
        expect(refreshModel).toHaveBeenCalledOnce();
        expect(refreshStats).toHaveBeenCalledOnce();
        expect(registerPiCommands).toHaveBeenCalledOnce();
    });
});
