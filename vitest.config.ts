import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["src/**/*.test.ts"],
        // Mock obsidian module since it's not available in test environment
        deps: {
            inline: [],
        },
    },
    resolve: {
        alias: {
            obsidian: "./src/__mocks__/obsidian.ts",
        },
    },
});