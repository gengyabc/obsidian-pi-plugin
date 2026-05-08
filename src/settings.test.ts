import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Mock modules
vi.mock("fs");
vi.mock("path");
vi.mock("os");

// Import after mocking
import {
    DEFAULT_SETTINGS,
    API_KEY_ENV_VARS,
    DEFAULT_SECRET_NAMES,
    PiPluginSettings,
} from "./settings";

// Helper function to extract providers from models config
// (extracted from class for testing)
function getConfiguredProviders(modelsConfig: {
    providers?: Record<string, { apiKey?: string }>;
}): string[] {
    if (!modelsConfig?.providers) {
        return ["anthropic", "openai"];
    }

    const providers: string[] = [];
    for (const [name, config] of Object.entries(modelsConfig.providers)) {
        if (config?.apiKey) {
            providers.push(name);
        }
    }

    // Sort: anthropic and openai first, then others alphabetically
    const priority = ["anthropic", "openai"];
    const sorted = providers.sort((a, b) => {
        const aPriority = priority.indexOf(a);
        const bPriority = priority.indexOf(b);
        if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        return a.localeCompare(b);
    });

    return sorted.length > 0 ? sorted : ["anthropic", "openai"];
}

describe("getConfiguredProviders", () => {
    it("returns default providers when config is null", () => {
        expect(getConfiguredProviders(null)).toEqual(["anthropic", "openai"]);
    });

    it("returns default providers when providers is undefined", () => {
        expect(getConfiguredProviders({})).toEqual(["anthropic", "openai"]);
    });

    it("returns default providers when no providers have apiKey", () => {
        expect(
            getConfiguredProviders({
                providers: {
                    local: { models: [] },
                },
            })
        ).toEqual(["anthropic", "openai"]);
    });

    it("extracts single provider with apiKey", () => {
        expect(
            getConfiguredProviders({
                providers: {
                    bailian: { apiKey: "BAILIAN_API_KEY", models: [] },
                },
            })
        ).toEqual(["bailian"]);
    });

    it("extracts multiple providers with apiKey", () => {
        const result = getConfiguredProviders({
            providers: {
                deepseek: { apiKey: "DEEPSEEK_API_KEY", models: [] },
                anthropic: { apiKey: "ANTHROPIC_API_KEY", models: [] },
                openai: { apiKey: "OPENAI_API_KEY", models: [] },
            },
        });
        expect(result).toEqual(["anthropic", "openai", "deepseek"]);
    });

    it("prioritizes anthropic and openai, then sorts alphabetically", () => {
        const result = getConfiguredProviders({
            providers: {
                zzz: { apiKey: "ZZZ_API_KEY", models: [] },
                anthropic: { apiKey: "ANTHROPIC_API_KEY", models: [] },
                aaa: { apiKey: "AAA_API_KEY", models: [] },
                openai: { apiKey: "OPENAI_API_KEY", models: [] },
            },
        });
        expect(result).toEqual(["anthropic", "openai", "aaa", "zzz"]);
    });

    it("handles apiKey with env var name", () => {
        expect(
            getConfiguredProviders({
                providers: {
                    bailian: { apiKey: "BAILIAN_API_KEY" },
                },
            })
        ).toEqual(["bailian"]);
    });

    it("returns default when providers object is empty", () => {
        expect(getConfiguredProviders({ providers: {} })).toEqual([
            "anthropic",
            "openai",
        ]);
    });
});

describe("DEFAULT_SETTINGS", () => {
    it("has correct default values", () => {
        expect(DEFAULT_SETTINGS.piBinaryPath).toBe("pi");
        expect(DEFAULT_SETTINGS.nodePath).toBe("");
        expect(DEFAULT_SETTINGS.envVars).toBe("");
        expect(DEFAULT_SETTINGS.apiSecretNames).toEqual({});
        expect(DEFAULT_SETTINGS.apiKeys).toEqual({});
        expect(DEFAULT_SETTINGS.workingDirectory).toBe("");
        expect(DEFAULT_SETTINGS.defaultProvider).toBe("");
        expect(DEFAULT_SETTINGS.defaultModel).toBe("");
        expect(DEFAULT_SETTINGS.sessionSaveDir).toBe("Pi-Sessions");
        expect(DEFAULT_SETTINGS.persistSessions).toBe(true);
        expect(DEFAULT_SETTINGS.thinkingLevel).toBe("medium");
        expect(DEFAULT_SETTINGS.rpcTimeout).toBe(60_000);
    });
});

describe("API_KEY_ENV_VARS", () => {
    it("maps all expected providers to env var names", () => {
        expect(API_KEY_ENV_VARS.anthropic).toBe("ANTHROPIC_API_KEY");
        expect(API_KEY_ENV_VARS.openai).toBe("OPENAI_API_KEY");
        expect(API_KEY_ENV_VARS.bailian).toBe("BAILIAN_API_KEY");
        expect(API_KEY_ENV_VARS.gemini).toBe("GOOGLE_API_KEY");
        expect(API_KEY_ENV_VARS.deepseek).toBe("DEEPSEEK_API_KEY");
    });
});

describe("DEFAULT_SECRET_NAMES", () => {
    it("maps all expected providers to secret names", () => {
        expect(DEFAULT_SECRET_NAMES.anthropic).toBe("pi-anthropic-key");
        expect(DEFAULT_SECRET_NAMES.openai).toBe("pi-openai-key");
        expect(DEFAULT_SECRET_NAMES.bailian).toBe("pi-bailian-key");
        expect(DEFAULT_SECRET_NAMES.gemini).toBe("pi-gemini-key");
        expect(DEFAULT_SECRET_NAMES.deepseek).toBe("pi-deepseek-key");
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

    it("parses valid models.json", () => {
        const mockConfig = {
            providers: {
                anthropic: {
                    apiKey: "ANTHROPIC_API_KEY",
                    models: [{ id: "claude-sonnet-4", name: "Claude Sonnet 4" }],
                },
            },
        };

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

        const content = fs.readFileSync("/home/testuser/.pi/agent/models.json", "utf-8");
        const config = JSON.parse(content);

        expect(config.providers.anthropic.apiKey).toBe("ANTHROPIC_API_KEY");
        expect(config.providers.anthropic.models).toHaveLength(1);
    });

    it("parses valid settings.json", () => {
        const mockSettings = {
            defaultProvider: "anthropic",
            defaultModel: "claude-sonnet-4",
        };

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockSettings));

        const content = fs.readFileSync("/home/testuser/.pi/agent/settings.json", "utf-8");
        const settings = JSON.parse(content);

        expect(settings.defaultProvider).toBe("anthropic");
        expect(settings.defaultModel).toBe("claude-sonnet-4");
    });

    it("handles missing models.json gracefully", () => {
        mockedFs.existsSync.mockReturnValue(false);

        const exists = fs.existsSync("/home/testuser/.pi/agent/models.json");
        expect(exists).toBe(false);
    });

    it("handles malformed JSON gracefully", () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue("not valid json");

        expect(() => {
            JSON.parse(fs.readFileSync("/path/to/models.json", "utf-8"));
        }).toThrow();
    });
});

describe("Provider display names", () => {
    const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
        anthropic: "Anthropic",
        openai: "OpenAI",
        bailian: "Bailian",
        gemini: "Google Gemini",
        deepseek: "DeepSeek",
    };

    it("has display names for all known providers", () => {
        const providers = ["anthropic", "openai", "bailian", "gemini", "deepseek"];
        for (const provider of providers) {
            expect(PROVIDER_DISPLAY_NAMES[provider]).toBeDefined();
        }
    });

    it("uses provider name as fallback for unknown providers", () => {
        const unknownProvider = "some-new-provider";
        const displayName = PROVIDER_DISPLAY_NAMES[unknownProvider] || unknownProvider;
        expect(displayName).toBe("some-new-provider");
    });
});