// This test file legitimately needs to:
//  1. `require()` Node built-ins to mutate the same CJS module instance the
//     source code holds (vi.mock / spyOn don't reach `require()` calls in
//     guarded init blocks, and ESM namespaces are sealed).
//  2. Read raw function references off `fs`/`os`/`path` to snapshot and later
//     restore them. These methods don't use `this`, so unbound-method is a
//     false positive here.
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/unbound-method */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { PathLike, PathOrFileDescriptor } from "fs";

const fs = require("fs") as typeof import("fs");
const os = require("os") as typeof import("os");
const path = require("path") as typeof import("path");

import { readPiModelsConfig } from "./pi-config-reader";

const HOME = "/home/testuser";
const USER_MODELS_PATH = `${HOME}/.pi/agent/models.json`;

describe("readPiModelsConfig — JSON5 parsing", () => {
    // Snapshot the real implementations once, before any test mutates them.
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;
    const originalHomedir = os.homedir;
    const originalJoin = path.join;

    beforeEach(() => {
        os.homedir = () => HOME;
        path.join = (...args: string[]) => args.join("/");
    });

    afterEach(() => {
        fs.existsSync = originalExistsSync;
        fs.readFileSync = originalReadFileSync;
        os.homedir = originalHomedir;
        path.join = originalJoin;
    });

    function mockUserConfig(content: string): void {
        fs.existsSync = (p: PathLike) => p === USER_MODELS_PATH;
        fs.readFileSync = ((p: PathOrFileDescriptor) => {
            if (p === USER_MODELS_PATH) return content;
            throw new Error(`unexpected read: ${String(p)}`);
        }) as typeof fs.readFileSync;
    }

    it("parses strictly-valid JSON (regression: behavior preserved)", () => {
        mockUserConfig(
            JSON.stringify({
                providers: {
                    anthropic: {
                        apiKey: "ANTHROPIC_API_KEY",
                        models: [{ id: "claude-sonnet-4", name: "Claude Sonnet 4" }],
                    },
                },
            }),
        );

        const { providers, error } = readPiModelsConfig();

        expect(error).toBeUndefined();
        expect(providers).toHaveLength(1);
        expect(providers[0]).toMatchObject({
            name: "anthropic",
            envVarName: "ANTHROPIC_API_KEY",
        });
        expect(providers[0].models).toEqual([
            { id: "claude-sonnet-4", name: "Claude Sonnet 4", reasoning: undefined, contextWindow: undefined },
        ]);
    });

    it("parses JSON5 with line comments, block comments, and trailing commas", () => {
        // This is the whole point of the change: Pi's own parser accepts this,
        // so the plugin must accept it too — otherwise the UI surfaces a parse
        // error on configs that Pi itself happily loads.
        const json5Content = `{
            // Top-level providers map
            "providers": {
                "anthropic": {
                    /* env var Pi expects */
                    "apiKey": "ANTHROPIC_API_KEY",
                    "models": [
                        { "id": "claude-sonnet-4", "name": "Claude Sonnet 4" }, // trailing comma below
                    ],
                },
            },
        }`;
        mockUserConfig(json5Content);

        const { providers, error } = readPiModelsConfig();

        expect(error).toBeUndefined();
        expect(providers).toHaveLength(1);
        expect(providers[0].name).toBe("anthropic");
        expect(providers[0].envVarName).toBe("ANTHROPIC_API_KEY");
        expect(providers[0].models).toHaveLength(1);
        expect(providers[0].models[0].id).toBe("claude-sonnet-4");
    });

    it("returns an error when the file exists but is unparseable", () => {
        mockUserConfig("this is not json or json5 {{{");

        const { providers, error } = readPiModelsConfig();

        expect(providers).toEqual([]);
        expect(error).toBeDefined();
        expect(error).toContain("Failed to read");
    });
});
