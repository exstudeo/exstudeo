/**
 * @file utils.ts
 *
 * Shared EPUB utility functions.
 *
 * @module epub-utils
 */

/**
 * Characters forbidden in FSA (File System Access API) filenames:
 * `:`, `\`, `/`, `?`, `"`, `<`, `>`, `|`
 *
 * Replaced with `_` to prevent silent write failures when EPUB
 * uniqueIdentifiers contain these characters (common URN schemes
 * like `urn:uuid:...` and `urn:isbn:...` contain colons).
 */
export const FSA_INVALID_CHARS = /[:\\/?"<>|]/g

/**
 * Sanitize a string for use as a ZenFS/FSA filename by replacing
 * forbidden characters with `_`.
 *
 * @param name - The identifier or name to sanitize.
 * @returns A filesystem-safe string.
 */
export function sanitizeFilename(name: string): string {
  return name.replace(FSA_INVALID_CHARS, "_")
}