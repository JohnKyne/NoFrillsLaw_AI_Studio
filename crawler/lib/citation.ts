/** Neutral-citation helpers shared by the listing and archive collectors. */

/** Map a neutral-citation court token to a human-readable court name. */
export function courtFromCitation(citation: string | null): string | null {
  if (!citation) return null;
  if (citation.includes('IESCDET')) return 'Supreme Court (Determination)';
  const token = citation.match(/^\d{4}_IE([A-Z]+)_/)?.[1];
  const map: Record<string, string> = {
    SC: 'Supreme Court',
    CA: 'Court of Appeal',
    HC: 'High Court',
    CC: 'Circuit Court',
    DC: 'District Court',
    CCC: 'Central Criminal Court',
    CCA: 'Court of Criminal Appeal',
  };
  return token ? map[token] ?? `Unknown (IE${token})` : null;
}

/** Parse a neutral citation out of a PDF filename/stem, if present. */
export function citationFromFilename(filename: string): string | null {
  const base = decodeURIComponent(filename).replace(/\.pdf$/i, '');
  return base.match(/\d{4}_IE[A-Z]+_?\d*/i)?.[0] ?? null;
}
