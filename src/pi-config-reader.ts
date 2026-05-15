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

// Guard Node.js imports for desktop-only (Rule 36)
let fs: typeof import("fs");
let os: typeof import("os");
let path: typeof import("path");

if (Platform.isDesktop) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Node.js fs module only available on desktop
    fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Node.js os module only available on desktop
    os = require("os");
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Node.js path module only available on desktop
    path = require("path");
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
            const userConfig = JSON.parse(content) as PiModelsJson;
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
                const projectConfig = JSON.parse(content) as PiModelsJson;
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

        result.push({
            name: providerName,
            envVarName: config.apiKey || "",
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