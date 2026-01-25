/**
 * String utilities for consistent text processing
 */

/**
 * Sanitize a region name to a valid filename.
 * - Replaces spaces with underscores
 * - Removes special characters except alphanumeric, underscore, and hyphen
 *
 * @example
 * sanitizeFilename("Costa Rica") // "Costa_Rica"
 * sanitizeFilename("São Paulo") // "So_Paulo"
 */
export function sanitizeFilename(name: string): string {
	return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
}
