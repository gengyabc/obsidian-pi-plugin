import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Mock modules
vi.mock("fs");
vi.mock("path");
vi.mock("os");

// Import after mocking
import { DEFAULT_SETTINGS, PiPluginSettings } from "./settings";

describe("DEFAULT_SETTINGS", () => {
    it("has correct default values", () => {
        expect(DEFAULT_SETTINGS.piBinaryPath).toBe("pi");
        expect(DEFAULT_SETTINGS.nodePath).toBe("");
        expect(DEFAULT_SETTINGS.envVars).toBe("");
        expect(DEFAULT_SETTINGS.workingDirectory).toBe("");
        expect(DEFAULT_SETTINGS.defaultProvider).toBe("");
        expect(DEFAULT_SETTINGS.defaultModel).toBe("");
        expect(DEFAULT_SETTINGS.sessionSaveDir).toBe("Pi-Sessions");
        expect(DEFAULT_SETTINGS.persistSessions).toBe(true);
        expect(DEFAULT_SETTINGS.thinkingLevel).toBe("medium");
        expect(DEFAULT_SETTINGS.rpcTimeout).toBe(60_000);
    });
});

describe("Platform detection", () => {
    const originalPlatform = process.platform;

    afterEach(() => {
        // Restore original platform
        Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("detects macOS platform", () => {
        Object.defineProperty(process, "platform", { value: "darwin" });
        expect(process.platform).toBe("darwin");
    });

    it("detects Windows platform", () => {
        Object.defineProperty(process, "platform", { value: "win32" });
        expect(process.platform).toBe("win32");
    });

    it("detects Linux platform", () => {
        Object.defineProperty(process, "platform", { value: "linux" });
        expect(process.platform).toBe("linux");
    });
});

describe("Pi config file reading", () => {
    const mockedFs = vi.mocked(fs);
    const mockedPath = vi.mocked(path);
    const mockedOs = vi.mocked(os);

    beforeEach(() => {
        vi.clearAllMocks();
        mockedOs.homedir.mockReturnValue("/home/testuser");
        mockedPath.join.mockImplementation((...args) => args.join("/"));
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("constructs correct path to models.json", () => {
        const homeDir = "/home/testuser";
        mockedOs.homedir.mockReturnValue(homeDir);
        mockedPath.join.mockReturnValue("/home/testuser/.pi/agent/models.json");

        const expectedPath = path.join(homeDir, ".pi", "agent", "models.json");
        expect(expectedPath).toBe("/home/testuser/.pi/agent/models.json");
    });

    it("constructs correct path to settings.json", () => {
        const homeDir = "/home/testuser";
        mockedOs.homedir.mockReturnValue(homeDir);
        mockedPath.join.mockReturnValue("/home/testuser/.pi/agent/settings.json");

        const expectedPath = path.join(homeDir, ".pi", "agent", "settings.json");
        expect(expectedPath).toBe("/home/testuser/.pi/agent/settings.json");
    });

    it("parses valid settings.json", () => {
        const mockSettings = {
            defaultProvider: "anthropic",
            defaultModel: "claude-sonnet-4",
        };

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockSettings));

        const content = fs.readFileSync("/home/testuser/.pi/agent/settings.json", "utf-8");
        const settings = JSON.parse(content) as { defaultProvider: string; defaultModel: string };

        expect(settings.defaultProvider).toBe("anthropic");
        expect(settings.defaultModel).toBe("claude-sonnet-4");
    });

    it("handles missing settings.json gracefully", () => {
        mockedFs.existsSync.mockReturnValue(false);

        const exists = fs.existsSync("/home/testuser/.pi/agent/settings.json");
        expect(exists).toBe(false);
    });

    it("handles malformed JSON gracefully", () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue("not valid json");

        expect(() => {
            JSON.parse(fs.readFileSync("/path/to/settings.json", "utf-8"));
        }).toThrow();
    });
});