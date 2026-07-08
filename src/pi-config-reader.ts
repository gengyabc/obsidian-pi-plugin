/**
 * Reads Pi's models.json configuration to discover providers and their env var requirements.
 *
 * This module reads from:
 * - User-level: ~/.pi/agent/models.json
 * - Project-level: <project>/.pi/models.json (if exists, overrides user-level)
 *
 * The apiKey field in provider config is the env var name Pi expects.
 */

import { Platform } from "obsidian";
import JSON5 from "json5";
import { getRecord, getString, isRecord } from "./json-utils";

// Guard Node.js imports for desktop-only (Rule 36)
let fs: typeof import("fs");
let os: typeof import("os");
let path: typeof import("path");

function loadDesktopModule(name: string): unknown {
    const desktopRequire: NodeJS.Require = require;
    return desktopRequire(name);
}

function parseModelConfig(model: Record<string, unknown>): PiModelConfig | null {
    const cost = getRecord(model, "cost");
    const compat = getRecord(model, "compat");
    const id = getString(model, "id");

    if (!id) {
        return null;
    }

    const inputValue = model["input"];
    const contextWindowValue = model["contextWindow"];
    const maxTokensValue = model["maxTokens"];
    const reasoningValue = model["reasoning"];
    const name = getString(model, "name") ?? "";

    return {
        id,
        name,
        reasoning: typeof reasoningValue === "boolean" ? reasoningValue : undefined,
        input: Array.isArray(inputValue) ? inputValue.filter((item): item is string => typeof item === "string") : undefined,
        contextWindow: typeof contextWindowValue === "number" ? contextWindowValue : undefined,
        maxTokens: typeof maxTokensValue === "number" ? maxTokensValue : undefined,
        cost: cost ? {
            input: typeof cost["input"] === "number" ? cost["input"] : undefined,
            output: typeof cost["output"] === "number" ? cost["output"] : undefined,
            cacheRead: typeof cost["cacheRead"] === "number" ? cost["cacheRead"] : undefined,
            cacheWrite: typeof cost["cacheWrite"] === "number" ? cost["cacheWrite"] : undefined,
        } : undefined,
        compat,
    };
}

function parseModelsJson(text: string): PiModelsJson {
    const parsed = JSON5.parse(text) as unknown;
    if (!isRecord(parsed)) {
        return {};
    }

    const providersValue = getRecord(parsed, "providers");
    if (!providersValue) {
        return {};
    }

    const providers: Record<string, PiProviderConfig> = {};
    for (const [providerName, providerValue] of Object.entries(providersValue)) {
        if (!isRecord(providerValue)) {
            continue;
        }

        const modelsValue = providerValue["models"];
        const models = Array.isArray(modelsValue)
            ? modelsValue
                .filter(isRecord)
                .map(parseModelConfig)
                .filter((model): model is PiModelConfig => model !== null)
            : undefined;

        providers[providerName] = {
            baseUrl: getString(providerValue, "baseUrl"),
            api: getString(providerValue, "api"),
            apiKey: getString(providerValue, "apiKey"),
            models,
        };
    }

    return { providers };
}

if (Platform.isDesktop) {
    fs = loadDesktopModule("fs") as typeof import("fs");
    os = loadDesktopModule("os") as typeof import("os");
    path = loadDesktopModule("path") as typeof import("path");
}

/** Model definition from Pi's models.json */
export interface PiModelConfig {
    id: string;
    name: string;
    reasoning?: boolean;
    input?: string[];
    contextWindow?: number;
    maxTokens?: number;
    cost?: {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
    };
    compat?: Record<string, unknown>;
}

/** Provider definition from Pi's models.json */
export interface PiProviderConfig {
    baseUrl?: string;
    api?: string;
    /** The env var name this provider expects for the API key */
    apiKey?: string;
    models?: PiModelConfig[];
}

/** Full models.json structure */
export interface PiModelsJson {
    providers?: Record<string, PiProviderConfig>;
}

/** Flattened provider info for UI display */
export interface ProviderInfo {
    name: string;
    envVarName: string;
    baseUrl?: string;
    api?: string;
    models: ModelInfo[];
}

/** Flattened model info for UI display */
export interface ModelInfo {
    id: string;
    name: string;
    reasoning?: boolean;
    contextWindow?: number;
}

/**
 * Read Pi's models.json configuration.
 * Merges user-level and project-level configs (project overrides user).
 * Returns { providers, error } - error is set if config file exists but cannot be parsed.
 */
export function readPiModelsConfig(projectPath?: string): { providers: ProviderInfo[]; error?: string } {
    if (!Platform.isDesktop) {
        return { providers: [] };
    }

    const providers: Record<string, PiProviderConfig> = {};
    let error: string | undefined;
    let configExists = false;

    // Read user-level config (~/.pi/agent/models.json)
    try {
        const homeDir = os.homedir();
        const userModelsPath = path.join(homeDir, ".pi", "agent", "models.json");
        if (fs.existsSync(userModelsPath)) {
            configExists = true;
            const content = fs.readFileSync(userModelsPath, "utf-8");
            const userConfig = parseModelsJson(content);
            if (userConfig.providers) {
                Object.assign(providers, userConfig.providers);
            }
        }
    } catch (err) {
        error = `Failed to read ~/.pi/agent/models.json: ${err instanceof Error ? err.message : String(err)}`;
        console.warn("[Pi Plugin]", error);
    }

    // Read project-level config (project/.pi/models.json) if provided
    if (projectPath) {
        try {
            const projectModelsPath = path.join(projectPath, ".pi", "models.json");
            if (fs.existsSync(projectModelsPath)) {
                configExists = true;
                const content = fs.readFileSync(projectModelsPath, "utf-8");
                const projectConfig = parseModelsJson(content);
                if (projectConfig.providers) {
                    // Project-level overrides user-level for same provider names
                    Object.assign(providers, projectConfig.providers);
                }
            }
        } catch (err) {
            error = `Failed to read project models.json: ${err instanceof Error ? err.message : String(err)}`;
            console.warn("[Pi Plugin]", error);
        }
    }

    // If config file exists but failed to parse, return error
    if (configExists && Object.keys(providers).length === 0 && error) {
        return { providers: [], error };
    }

    // Flatten to ProviderInfo array
    const result: ProviderInfo[] = [];
    for (const [providerName, config] of Object.entries(providers)) {
        const models: ModelInfo[] = (config.models || []).map((m) => ({
            id: m.id,
            name: m.name || m.id,
            reasoning: m.reasoning,
            contextWindow: m.contextWindow,
        }));

        // Pi's models.json conventionally references env vars as "$VAR_NAME"
        // (shell-style). Strip the leading `$` so downstream consumers see a
        // raw env var name — both for setting `process.env[name]` (rpc.ts) and
        // for deriving a SecretStorage ID (settings.ts), which rejects `$`.
        const rawApiKey = (config.apiKey || "").trim();
        const envVarName = rawApiKey.startsWith("$") ? rawApiKey.slice(1) : rawApiKey;

        result.push({
            name: providerName,
            envVarName,
            baseUrl: config.baseUrl,
            api: config.api,
            models,
        });
    }

    // Sort by name
    result.sort((a, b) => a.name.localeCompare(b.name));

    return { providers: result, error };
}

/**
 * Get the env var name for a specific provider.
 * Returns empty string if provider not found or has no apiKey field.
 */
export function getProviderEnvVarName(providers: ProviderInfo[], providerName: string): string {
    const provider = providers.find((p) => p.name === providerName);
    return provider?.envVarName || "";
}

/**
 * Get models for a specific provider.
 */
export function getProviderModels(providers: ProviderInfo[], providerName: string): ModelInfo[] {
    const provider = providers.find((p) => p.name === providerName);
    return provider?.models || [];
}

/**
 * Convenience wrapper that returns just the providers array.
 */
export function readProviders(projectPath?: string): ProviderInfo[] {
    return readPiModelsConfig(projectPath).providers;
}