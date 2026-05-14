/**
 * Loads Pi's models.json configuration to discover required API key environment variables.
 *
 * Pi stores provider configurations in ~/.pi/agent/models.json, where each provider
 * specifies which env var it needs (e.g., "apiKey": "BAILIAN_API_KEY").
 * The plugin reads this file to show users which env vars to set in their shell profile.
 */

import { Platform } from "obsidian";

// Guard Node.js imports for desktop-only (Rule 36)
let readFileSync: typeof import("fs").readFileSync;
let join: typeof import("path").join;

if (Platform.isDesktop) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ readFileSync } = require("fs"));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ join } = require("path"));
}

interface PiProviderConfig {
    baseUrl?: string;
    api?: string;
    /** Environment variable name for the API key (e.g., "BAILIAN_API_KEY") */
    apiKey: string;
    models: Array<{
        id: string;
        name: string;
        reasoning?: boolean;
        input?: string[];
        contextWindow?: number;
        maxTokens?: number;
    }>;
}

export interface PiModelsConfig {
    providers: Record<string, PiProviderConfig>;
}

/**
 * Load Pi's models.json configuration file.
 * Returns null if file doesn't exist or can't be parsed.
 */
export function loadPiModelsConfig(): PiModelsConfig | null {
    if (!Platform.isDesktop) return null;

    const home = process.env.HOME || process.env.USERPROFILE || "";
    if (!home) return null;

    const configPath = join(home, ".pi", "agent", "models.json");

    try {
        const content = readFileSync(configPath, "utf-8");
        return JSON.parse(content) as PiModelsConfig;
    } catch {
        return null;
    }
}

/**
 * Get list of environment variable names required by Pi providers.
 * These are the env vars users need to set in their shell profile.
 */
export function getRequiredEnvVars(config: PiModelsConfig | null): string[] {
    if (!config) return [];

    const envVars = new Set<string>();
    for (const provider of Object.values(config.providers)) {
        if (provider.apiKey) {
            envVars.add(provider.apiKey);
        }
    }
    return [...envVars];
}

/**
 * Get provider information with their required env vars and models.
 * Used for displaying in settings UI.
 */
export function getProviderInfo(config: PiModelsConfig | null): Array<{
    name: string;
    envVar: string;
    models: string[];
}> {
    if (!config) return [];

    const result: Array<{ name: string; envVar: string; models: string[] }> = [];

    for (const [providerName, providerConfig] of Object.entries(config.providers)) {
        result.push({
            name: providerName,
            envVar: providerConfig.apiKey,
            models: providerConfig.models.map((m) => m.id),
        });
    }

    return result;
}

/**
 * Check which required env vars are currently available in process.env.
 * Returns { detected: string[], missing: string[] }
 */
export function checkEnvVarStatus(config: PiModelsConfig | null): {
    detected: string[];
    missing: string[];
} {
    const required = getRequiredEnvVars(config);
    const detected: string[] = [];
    const missing: string[] = [];

    for (const envVar of required) {
        if (process.env[envVar]) {
            detected.push(envVar);
        } else {
            missing.push(envVar);
        }
    }

    return { detected, missing };
}
