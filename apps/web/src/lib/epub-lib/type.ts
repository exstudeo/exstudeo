/** Metadata extracted from an EPUB's OPF package document. */
export interface IEpub {
  /** The EPUB version, e.g. "2.0", "3.0", "3.2". */
  version: string

  /**
   * The EPUB's unique identifier scheme (opf:scheme in EPUB 2, or the
   * <dc:identifier> element's id attribute in EPUB 3).
   */
  uniqueIdentifierScheme?: string

  /** The EPUB's unique identifier, as specified in the package document. */
  uniqueIdentifier: string

  /** The EPUB's title, as specified in the package document. */
  title?: string

  /** Path to the OPF file within the unzipped EPUB content. */
  OpfPath: string
}

/**
 * A recursive tree of EPUB collections.
 *
 * Each key maps to either a sub-collection (nested `EpubCollection`) or
 * an EPUB leaf node (`IEpub`). The key for a sub-collection is its
 * directory name in ZenFS. The key for an EPUB leaf is its `uniqueIdentifier`.
 */
export type EpubCollection = {
  [key: string]: EpubCollection | IEpub
}

/**
 * Type guard — returns `true` if `value` is an {@link IEpub} leaf node.
 *
 * Checks for the required `uniqueIdentifier` string property which only
 * exists on `IEpub`, not on `EpubCollection`.
 */
export function isEpub(value: EpubCollection | IEpub): value is IEpub {
  return (
    typeof value === "object" &&
    value !== null &&
    "uniqueIdentifier" in value &&
    typeof (value as IEpub).uniqueIdentifier === "string"
  )
}






