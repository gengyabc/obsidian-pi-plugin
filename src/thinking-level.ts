export const PI_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export type PiThinkingLevel = typeof PI_THINKING_LEVELS[number];

const PI_THINKING_LEVEL_SET = new Set<string>(PI_THINKING_LEVELS);

export function normalizeThinkingLevel(level: string | null | undefined, fallback: PiThinkingLevel = "medium"): PiThinkingLevel {
    if (!level) return fallback;

    if (level === "none") return "off";

    if (PI_THINKING_LEVEL_SET.has(level)) {
        return level as PiThinkingLevel;
    }

    return fallback;
}

export function shouldDisplayThinkingLevel(level: string | null | undefined): boolean {
    return normalizeThinkingLevel(level, "off") !== "off";
}
