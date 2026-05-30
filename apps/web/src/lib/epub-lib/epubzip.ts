/**
 * @file epubzip.ts
 *
 * EPUB metadata extraction using JSZip and DOM/XML parsing.
 *
 * Given a `File` object representing an EPUB, this module provides:
 * - Unzipping the EPUB into a `Map<string, ArrayBuffer>` of paths → content
 * - Parsing `META-INF/container.xml` to locate the OPF file
 * - Parsing the OPF file to extract `IEpub` metadata (title, identifier, version)
 *
 * @module epub-zip
 */

import { type IEpub } from "./type"

// JSZip is a runtime dependency; the types come from the jszip package.
import JSZip from "jszip"

/**
 * Result of extracting and parsing an EPUB file.
 */
export interface EpubExtractResult {
  /** Original File object. */
  file: File
  /** Unzipped content keyed by file path (relative to the EPUB archive root). */
  entries: Map<string, ArrayBuffer>
  /** Parsed metadata from the OPF package document. */
  metadata: IEpub
}

/**
 * Unzip an EPUB `File` and extract metadata from its OPF package document.
 *
 * Steps:
 * 1. Read the file as an `ArrayBuffer`
 * 2. Unzip with JSZip → `Map<string, ArrayBuffer>`
 * 3. Read `META-INF/container.xml` to find the OPF path
 * 4. Parse the OPF file to extract version, title, unique identifier
 * 5. Return the combined result
 *
 * @param file  An EPUB file selected by the user.
 * @returns The extracted result.
 */
export async function extractEpub(file: File): Promise<EpubExtractResult> {
  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  const entries = new Map<string, ArrayBuffer>()
  const entryPromises: Promise<void>[] = []

  zip.forEach((path, zipEntry) => {
    entryPromises.push(
      zipEntry.async("arraybuffer").then((data) => {
        entries.set(path, data)
      }),
    )
  })

  await Promise.all(entryPromises)

  // Locate the OPF file via container.xml
  const containerXml = entries.get("META-INF/container.xml")
  if (!containerXml) {
    throw new Error("Missing META-INF/container.xml — not a valid EPUB.")
  }
  const opfPath = parseContainerXml(containerXml)
  const opfData = entries.get(opfPath)
  if (!opfData) {
    throw new Error(`OPF file "${opfPath}" not found in EPUB archive.`)
  }

  const metadata = parseOpf(opfData, opfPath)

  return { file, entries, metadata }
}

/**
 * Parse `META-INF/container.xml` and return the OPF file path.
 *
 * The XML looks like:
 * ```xml
 * <container>
 *   <rootfiles>
 *     <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
 *   </rootfiles>
 * </container>
 * ```
 */
function parseContainerXml(data: ArrayBuffer): string {
  const decoder = new TextDecoder("utf-8")
  const xml = decoder.decode(data)
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "application/xml")

  const rootfile = doc.querySelector("rootfile")
  if (!rootfile) {
    throw new Error("No <rootfile> element found in container.xml.")
  }

  const fullPath = rootfile.getAttribute("full-path")
  if (!fullPath) {
    throw new Error("No full-path attribute on <rootfile>.")
  }

  return fullPath
}

/**
 * Parse the OPF package document and return {@link IEpub} metadata.
 *
 * Handles both EPUB 2 (`<package version="2.0">`) and EPUB 3
 * (`<package version="3.0">`) package documents.
 */
function parseOpf(data: ArrayBuffer, opfPath: string): IEpub {
  const decoder = new TextDecoder("utf-8")
  const xml = decoder.decode(data)
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "application/xml")

  const packageEl = doc.querySelector("package")
  const version = packageEl?.getAttribute("version") ?? "unknown"
  const uniqueIdentifierId = packageEl?.getAttribute("unique-identifier")

  // Resolve the unique identifier
  let uniqueIdentifier = ""
  let uniqueIdentifierScheme: string | undefined

  // EPUB 2: <dc:identifier opf:scheme="ISBN">
  // EPUB 3: <dc:identifier id="book-id">
  const identifiers = doc.querySelectorAll("identifier, dc\\:identifier")
  for (const el of identifiers) {
    const id = el.getAttribute("id")
    if (id === uniqueIdentifierId) {
      uniqueIdentifier = el.textContent?.trim() ?? ""
      uniqueIdentifierScheme = el.getAttribute("opf:scheme") ?? undefined
      break
    }
  }
  // Fallback: first identifier if no match
  if (!uniqueIdentifier && identifiers.length > 0) {
    const first = identifiers[0]
    uniqueIdentifier = first.textContent?.trim() ?? ""
    uniqueIdentifierScheme = first.getAttribute("opf:scheme") ?? undefined
  }

  // Resolve title
  const titleEl = doc.querySelector("title, dc\\:title")
  const title = titleEl?.textContent?.trim() ?? undefined

  return {
    version,
    uniqueIdentifier,
    uniqueIdentifierScheme,
    title,
    OpfPath: opfPath,
  }
}