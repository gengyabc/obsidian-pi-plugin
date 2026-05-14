/**
 * Notice utility for user-facing error messages.
 */

import { Notice } from "obsidian";

/**
 * Show a sticky notice that stays until the user clicks it.
 */
export function showCriticalNotice(message: string): void {
    new Notice(message, 0);
}