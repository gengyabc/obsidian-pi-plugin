export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export function getString(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    return typeof value === "string" ? value : undefined;
}

export function getNumber(record: Record<string, unknown>, key: string): number | undefined {
    const value = record[key];
    return typeof value === "number" ? value : undefined;
}

export function getBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
    const value = record[key];
    return typeof value === "boolean" ? value : undefined;
}

export function getRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
    const value = record[key];
    return isRecord(value) ? value : undefined;
}

export function getArray(record: Record<string, unknown>, key: string): unknown[] | undefined {
    const value = record[key];
    return Array.isArray(value) ? value : undefined;
}

export function parseJsonRecord(text: string): Record<string, unknown> | null {
    const value = JSON.parse(text) as unknown;
    return isRecord(value) ? value : null;
}
