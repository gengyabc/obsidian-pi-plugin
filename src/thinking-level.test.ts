import { describe, expect, it } from "vitest";
import { normalizeThinkingLevel, resolveDisplayedThinkingLevel, shouldDisplayThinkingLevel } from "./thinking-level";

describe("normalizeThinkingLevel", () => {
    it("keeps supported levels", () => {
        expect(normalizeThinkingLevel("low")).toBe("low");
        expect(normalizeThinkingLevel("medium")).toBe("medium");
        expect(normalizeThinkingLevel("high")).toBe("high");
    });

    it("migrates legacy none to off", () => {
        expect(normalizeThinkingLevel("none")).toBe("off");
    });

    it("falls back for invalid or empty values", () => {
        expect(normalizeThinkingLevel("")).toBe("medium");
        expect(normalizeThinkingLevel("wat")).toBe("medium");
        expect(normalizeThinkingLevel(undefined, "off")).toBe("off");
    });
});

describe("shouldDisplayThinkingLevel", () => {
    it("hides off-like values", () => {
        expect(shouldDisplayThinkingLevel("off")).toBe(false);
        expect(shouldDisplayThinkingLevel("none")).toBe(false);
    });

    it("shows active thinking levels", () => {
        expect(shouldDisplayThinkingLevel("low")).toBe(true);
        expect(shouldDisplayThinkingLevel("medium")).toBe(true);
    });
});

describe("resolveDisplayedThinkingLevel", () => {
    it("prefers the configured plugin setting over stale runtime state", () => {
        expect(resolveDisplayedThinkingLevel("low", "medium")).toBe("low");
        expect(resolveDisplayedThinkingLevel("off", "medium")).toBe("off");
    });

    it("falls back to runtime state when the configured value is missing", () => {
        expect(resolveDisplayedThinkingLevel("", "high")).toBe("high");
        expect(resolveDisplayedThinkingLevel(undefined, "minimal")).toBe("minimal");
    });
});
