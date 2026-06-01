/** Shared record shapes emitted to JSONL. One interface per collector. */

/** A judgment (or determination) document harvested from the listing pages. */
export interface JudgmentRecord {
  /** Neutral citation parsed from the PDF filename, e.g. "2026_IEHC_186". */
  citation: string | null;
  /** Court inferred from the citation prefix (IEHC -> High Court, etc.). */
  court: string | null;
  /** Absolute URL of the judgment PDF. */
  pdfUrl: string;
  /** Alfresco UUID from the PDF path (stable document id). */
  documentId: string | null;
  /** Visible link/title text on the listing, if any. */
  title: string | null;
  /** Listing page number this record was found on. */
  page: number;
  /** ISO timestamp when scraped. */
  scrapedAt: string;
}

/** A party as returned inside an HCS case record. */
export interface HcsParty {
  arch_name?: string;
  arch_partyfirstname?: string;
  arch_partylastname?: string;
  arch_companyname?: string;
  arch_partyordersequence?: number;
  arch_caserole?: { arch_name?: string };
  arch_legalfirm?: { arch_name?: string };
}

/** Lightweight row from the GetCases list endpoint (step 1). */
export interface HcsListRow {
  arch_caseid: string;
  arch_name: string; // case reference, e.g. "H.P.2024.0000001"
  arch_publiccasetitle: string;
  arch_oldcasereference?: string;
  arch_dateofissue?: string;
  case_parties?: HcsParty[];
}

/** Full case record from GetCaseRefDetails (step 2), merged with the list row. */
export interface HcsCaseRecord extends HcsListRow {
  orders?: unknown[];
  listings?: unknown[];
  judgements?: unknown[];
  applications?: unknown[];
  related_cases?: unknown[];
  arch_appealcasereference?: string;
  arch_setdowndate?: string | null;
  /** ISO timestamp when the detail call completed. */
  scrapedAt: string;
}

/** A probate grant parsed from a results card. */
export interface ProbateRecord {
  deceasedName: string | null;
  dateOfDeath: string | null;
  grantType: string | null;
  address: string | null;
  caseRef: string | null;
  issuedDate: string | null;
  grantees: string[];
  /** The (firstname, lastname, year) query that surfaced this grant. */
  query: { firstname: string; lastname: string; year: string; page: number };
  scrapedAt: string;
}
