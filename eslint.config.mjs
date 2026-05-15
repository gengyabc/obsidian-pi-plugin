import eslint from "@eslint/js";
import json from "@eslint/json";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

const typedConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: ["**/*.ts", "**/*.tsx"],
  languageOptions: {
    ...config.languageOptions,
    parserOptions: {
      ...config.languageOptions?.parserOptions,
      project: "./tsconfig.json",
      tsconfigRootDir: import.meta.dirname,
    },
  },
}));

export default [
  {
    ignores: ["main.js", "package-lock.json", "eslint.config.mjs", "esbuild.config.mjs", "vitest.config.ts"],
  },
  eslint.configs.recommended,
  ...obsidianmd.configs.recommendedWithLocalesEn,
  ...typedConfigs,
  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    rules: {
      ...json.configs.recommended.rules,
      "@typescript-eslint/no-unused-expressions": "off",
      "no-irregular-whitespace": "off",
      "obsidianmd/no-plugin-as-component": "off",
      "obsidianmd/no-view-references-in-plugin": "off",
      "obsidianmd/no-unsupported-api": "off",
      "obsidianmd/prefer-file-manager-trash-file": "off",
      "obsidianmd/prefer-instanceof": "off",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
      "no-var": "off",
    },
  },
  {
    files: ["**/en.json", "**/en*.json", "**/en/*.json", "**/en/**/*.json"],
    rules: {
      "obsidianmd/ui/sentence-case-json": [
        "warn",
        {
          acronyms: ["API", "CMD", "GUI", "LLM", "MB", "PATH", "RPC"],
          brands: ["Pi", "Node", "Obsidian", "PowerShell", "SecretStorage", "macOS", "Windows", "Linux"],
        },
      ],
    },
  },
];
