/**
 * Helpers for manually configured Pi provider environment variables.
 *
 * This module intentionally does not inspect the user's home directory,
 * Pi config files, or shell environment. The plugin relies on explicit
 * user configuration in settings instead.
 */

/**
 * Parse a comma-separated list of environment variable names.
 */
export function parseConfiguredEnvVars(value: string): string[] {
    return [...new Set(
        value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
    )];
}
